import {
  nextRecord,
  readVolumeHeader,
  walkMessages,
  type Moment,
  type Radial,
  type VolumeHeader,
} from "./format";
import { siteById } from "./sites";
import { LowestScan, type Sweep } from "./sweep";
import { pickVolume, volumesAround, type VolumeRef } from "./volumes";

/**
 * One radar's lowest scan at a moment: what the site layer draws.
 */
export interface SiteScan {
  site: string;
  lat: number;
  lon: number;
  /** The volume it came from. */
  volume: VolumeRef;
  sweeps: Partial<Record<Moment, Sweep>>;
  /** Bytes fetched to get it. */
  bytes: number;
}

export interface ScanProgress {
  stage: "listing" | "reading";
  /** Bytes received so far. */
  bytes: number;
  /** Radials of the lowest scan gathered so far. */
  radials: number;
}

/** A reason there is nothing to draw, in words for the panel. */
export class NoScan extends Error {}

// --- the decoding pool ------------------------------------------------------

interface Job {
  resolve: (r: Radial[]) => void;
  reject: (e: Error) => void;
}

/**
 * A few workers undoing bzip2 in parallel. They are made on first use and let
 * go after a minute of nothing, so a map that never asks for radar never
 * starts one.
 */
class Pool {
  private workers: Worker[] = [];
  private turn = 0;
  private seq = 0;
  private readonly jobs = new Map<number, Job>();
  private idle: ReturnType<typeof setTimeout> | null = null;

  private start(): boolean {
    if (this.workers.length) return true;
    if (typeof Worker === "undefined") return false;
    const n = Math.max(
      1,
      Math.min(4, (navigator.hardwareConcurrency || 2) - 1),
    );
    try {
      for (let i = 0; i < n; i += 1) {
        const w = new Worker(new URL("./decoder.worker.ts", import.meta.url), {
          type: "module",
        });
        w.onmessage = (
          e: MessageEvent<{ id: number; radials?: Radial[]; error?: string }>,
        ) => {
          const job = this.jobs.get(e.data.id);
          if (!job) return;
          this.jobs.delete(e.data.id);
          if (e.data.radials) job.resolve(e.data.radials);
          else
            job.reject(
              new Error(
                e.data.error ?? "The radar record could not be unpacked.",
              ),
            );
          this.rest();
        };
        w.onerror = (e) => {
          e.preventDefault();
          for (const [id, job] of this.jobs) {
            job.reject(new Error("The radar decoder stopped."));
            this.jobs.delete(id);
          }
          this.stop();
        };
        this.workers.push(w);
      }
      return true;
    } catch {
      this.stop();
      return false;
    }
  }

  private rest() {
    if (this.idle) clearTimeout(this.idle);
    this.idle = setTimeout(() => {
      if (this.jobs.size === 0) this.stop();
    }, 60_000);
  }

  stop() {
    for (const w of this.workers) w.terminate();
    this.workers = [];
  }

  get size(): number {
    return Math.max(1, this.workers.length);
  }

  async run(bytes: Uint8Array): Promise<Radial[]> {
    if (!this.start()) return inline(bytes);
    const id = (this.seq += 1);
    const w = this.workers[this.turn++ % this.workers.length]!;
    const copy = bytes.slice().buffer;
    return new Promise<Radial[]>((resolve, reject) => {
      this.jobs.set(id, { resolve, reject });
      w.postMessage({ id, bytes: copy }, [copy]);
    });
  }
}

/** Where there are no workers (tests, very old browsers): do it here. */
async function inline(bytes: Uint8Array): Promise<Radial[]> {
  const mod = (await import("bz2")) as {
    decompress?: (b: Uint8Array, crc?: boolean) => Uint8Array;
  };
  // The package publishes itself onto `window` when there is one.
  const decompress =
    mod.decompress ??
    (
      globalThis as unknown as {
        bz2?: { decompress: (b: Uint8Array, crc?: boolean) => Uint8Array };
      }
    ).bz2?.decompress;
  if (!decompress) throw new Error("No bzip2 decoder.");
  const raw = decompress(bytes, false);
  const out: Radial[] = [];
  walkMessages(raw, 0, (r) => out.push(r));
  return out;
}

const pool = new Pool();

// --- reading a volume -------------------------------------------------------

/** Wakes one waiter. */
class Signal {
  private waiters: (() => void)[] = [];
  wait(): Promise<void> {
    return new Promise((r) => this.waiters.push(r));
  }
  fire() {
    const w = this.waiters;
    this.waiters = [];
    for (const f of w) f();
  }
}

const join = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  if (a.length === 0) return b;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
};

/**
 * Read a volume's lowest scan and stop.
 *
 * The file streams in; the moment the antenna is seen to leave the lowest
 * angle, the download is cancelled. That is three or four megabytes of a
 * twenty-megabyte volume, and for the older gzipped ones two or three.
 */
export async function readLowestScan(
  volume: VolumeRef,
  opts: { signal?: AbortSignal; onProgress?: (p: ScanProgress) => void } = {},
): Promise<SiteScan> {
  const stop = new AbortController();
  const outer = opts.signal;
  const onOuterAbort = () => stop.abort();
  outer?.addEventListener("abort", onOuterAbort);

  try {
    const res = await fetch(volume.url, { signal: stop.signal });
    if (!res.ok || !res.body)
      throw new NoScan(`The archive answered ${res.status} for ${volume.key}.`);

    let bytes = 0;
    const counted = res.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, ctl) {
          bytes += chunk.length;
          ctl.enqueue(chunk);
        },
      }),
    );
    const stream = volume.gz
      ? counted.pipeThrough(
          new DecompressionStream("gzip") as unknown as ReadableWritablePair<
            Uint8Array,
            Uint8Array
          >,
        )
      : counted;
    const reader = stream.getReader();

    const scan = new LowestScan();
    const queue: Promise<Radial[]>[] = [];
    const arrived = new Signal();
    const consumed = new Signal();
    let finished = false;
    let failure: unknown = null;
    const report = () =>
      opts.onProgress?.({ stage: "reading", bytes, radials: scan.radials });

    const produce = async () => {
      let pending: Uint8Array = new Uint8Array(0);
      let header: VolumeHeader | null = null;
      try {
        while (!scan.done) {
          const { value, done } = await reader.read();
          if (value) pending = join(pending, value);
          if (!header) {
            if (pending.length < 31 && !done) continue;
            header = readVolumeHeader(pending);
            if (!header) throw new NoScan("That file is not a radar volume.");
            pending = pending.subarray(24);
          }
          if (header.bzipped) {
            let at = 0;
            for (
              let rec = nextRecord(pending, at);
              rec;
              rec = nextRecord(pending, at)
            ) {
              queue.push(pool.run(pending.subarray(rec.start, rec.end)));
              at = rec.end;
              arrived.fire();
            }
            pending = pending.subarray(at);
            // Keep the decoders busy, but do not run a volume's length ahead of them.
            while (queue.length > pool.size * 2 && !scan.done)
              await consumed.wait();
          } else {
            const at = walkMessages(pending, 0, (r) => scan.add(r));
            pending = pending.subarray(at);
            report();
          }
          if (done) break;
        }
      } catch (err) {
        if (!scan.done) failure = err;
      } finally {
        finished = true;
        arrived.fire();
      }
    };

    const producing = produce();
    try {
      while (!scan.done) {
        const head = queue.shift();
        if (head) {
          const radials = await head;
          for (const r of radials) scan.add(r);
          consumed.fire();
          report();
          continue;
        }
        if (finished) break;
        await arrived.wait();
      }
    } finally {
      // Enough, or a failure: stop the download and let go of anything still decoding.
      stop.abort();
      consumed.fire();
      await producing;
      for (const q of queue) q.catch(() => undefined);
    }
    if (outer?.aborted) throw new DOMException("Aborted", "AbortError");
    if (failure && !scan.radials) throw failure;

    const sweeps = scan.sweeps();
    if (!sweeps.REF && !sweeps.VEL)
      throw new NoScan(
        `${volume.site}'s volume held no scan that could be read.`,
      );
    const known = siteById(volume.site);
    const at =
      scan.site ??
      (known ? { lat: known.lat, lon: known.lon, height: 0 } : null);
    if (!at) throw new NoScan(`Where ${volume.site} stands is not known.`);
    return {
      site: volume.site,
      lat: at.lat,
      lon: at.lon,
      volume,
      sweeps,
      bytes,
    };
  } finally {
    outer?.removeEventListener("abort", onOuterAbort);
  }
}

// --- the whole errand -------------------------------------------------------

const recent = new Map<string, SiteScan>();
const KEEP = 6;

/**
 * The lowest scan from `site` nearest `epochSeconds`: list the day, choose the
 * volume, read it. The last few are kept, so scrubbing back and forth over the
 * same minutes does not fetch them again.
 */
export async function scanFor(
  site: string,
  epochSeconds: number,
  opts: { signal?: AbortSignal; onProgress?: (p: ScanProgress) => void } = {},
): Promise<SiteScan> {
  opts.onProgress?.({ stage: "listing", bytes: 0, radials: 0 });
  const list = await volumesAround(site, epochSeconds, opts.signal);
  if (list.length === 0)
    throw new NoScan(`${site} has nothing in the archive for this day.`);
  const volume = pickVolume(list, epochSeconds);
  if (!volume)
    throw new NoScan(
      `${site} recorded nothing within twelve minutes of this moment.`,
    );
  const hit = recent.get(volume.key);
  if (hit) {
    recent.delete(volume.key);
    recent.set(volume.key, hit);
    return hit;
  }
  const scan = await readLowestScan(volume, opts);
  recent.set(volume.key, scan);
  while (recent.size > KEEP) recent.delete(recent.keys().next().value!);
  return scan;
}

/** Which volume `scanFor` would read, without reading it — for deciding whether the clock has moved on. */
export async function volumeFor(
  site: string,
  epochSeconds: number,
  signal?: AbortSignal,
): Promise<VolumeRef | null> {
  const list = await volumesAround(site, epochSeconds, signal);
  return pickVolume(list, epochSeconds);
}
