/**
 * Finding a radar's volume for a moment in NOAA's public Level II archive.
 *
 * The archive is an S3 bucket laid out by day and site —
 * `2024/05/21/KDMX/KDMX20240521_203103_V06` — that answers listings and
 * byte reads to any origin. It holds every WSR-88D volume from the early
 * nineties on: a volume every four to ten minutes per radar, each named for
 * the moment its scan began.
 *
 * (NOAA's own bucket, noaa-nexrad-level2, refuses anonymous reads now. This
 * is Unidata's mirror of the same archive.)
 */
export const BUCKET = "https://unidata-nexrad-level2.s3.amazonaws.com";

export interface VolumeRef {
  key: string;
  site: string;
  /** Epoch seconds the volume began. */
  time: number;
  url: string;
  /** Whole-file gzip (2015 and before) rather than bzip2 records. */
  gz: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The listing prefix for a site's UTC day. */
export function dayPrefix(site: string, epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  return `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${site}/`;
}

/** "…/KDMX20240521_203103_V06" -> a volume; model-data and test files -> null. */
export function volumeFromKey(key: string): VolumeRef | null {
  const m =
    /([A-Z]{4})(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:_V\d\d)?(\.gz)?$/.exec(
      key,
    );
  if (!m) return null;
  const [, site, y, mo, d, h, mi, s, gz] = m;
  const time = Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +s!) / 1000;
  return { key, site: site!, time, url: `${BUCKET}/${key}`, gz: Boolean(gz) };
}

/** Keys and the continuation token from a ListObjectsV2 reply. */
export function parseListing(xml: string): {
  keys: string[];
  next: string | null;
} {
  const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]!);
  const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
  const token =
    /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1] ??
    null;
  return { keys, next: truncated ? token : null };
}

const listed = new Map<string, Promise<VolumeRef[]>>();

async function listDay(
  prefix: string,
  signal?: AbortSignal,
): Promise<VolumeRef[]> {
  const out: VolumeRef[] = [];
  let token: string | null = null;
  for (let page = 0; page < 5; page += 1) {
    const q = new URLSearchParams({ "list-type": "2", prefix });
    if (token) q.set("continuation-token", token);
    const res = await fetch(`${BUCKET}/?${q}`, { signal });
    if (!res.ok) throw new Error(`The radar archive answered ${res.status}.`);
    const { keys, next } = parseListing(await res.text());
    for (const k of keys) {
      const v = volumeFromKey(k);
      if (v) out.push(v);
    }
    if (!next) break;
    token = next;
  }
  return out.sort((a, b) => a.time - b.time);
}

/**
 * Every volume a site recorded around a moment: its UTC day, and the
 * neighbouring day too when the moment is within half an hour of midnight.
 * Remembered for the session — the past does not change.
 */
export async function volumesAround(
  site: string,
  epochSeconds: number,
  signal?: AbortSignal,
): Promise<VolumeRef[]> {
  const days = new Set([dayPrefix(site, epochSeconds)]);
  days.add(dayPrefix(site, epochSeconds - 1800));
  days.add(dayPrefix(site, epochSeconds + 1800));
  const lists = await Promise.all(
    [...days].map((p) => {
      let hit = listed.get(p);
      if (!hit) {
        hit = listDay(p, signal);
        listed.set(p, hit);
        hit.catch(() => listed.delete(p));
      }
      return hit;
    }),
  );
  return lists.flat().sort((a, b) => a.time - b.time);
}

/**
 * How long after a volume begins its lowest scan is finished: that scan is
 * what gets drawn, so it is what "the scan for this moment" is measured from.
 */
export const LOWEST_SCAN_S = 30;

/** Further than this from any scan and the honest answer is "no scan". */
export const NEAREST_WITHIN_S = 12 * 60;

/** The volume whose lowest scan is nearest the moment, or null if none is close. */
export function pickVolume(
  list: readonly VolumeRef[],
  epochSeconds: number,
): VolumeRef | null {
  let best: VolumeRef | null = null;
  let gap = Infinity;
  for (const v of list) {
    const g = Math.abs(v.time + LOWEST_SCAN_S - epochSeconds);
    if (g < gap) {
      gap = g;
      best = v;
    }
  }
  return gap <= NEAREST_WITHIN_S ? best : null;
}
