/**
 * Reading NEXRAD Level II: the radar's own measurements, gate by gate (#7).
 *
 * The national composite the reflectivity layer uses is a picture someone
 * else has already made, and it only carries reflectivity. Velocity, and the
 * correlation coefficient that shows a tornado's debris, exist only in the
 * archive each radar writes of its own scans: Level II. NOAA keeps every
 * volume since the early nineties in a public bucket, and this is the part
 * that turns those bytes back into radials.
 *
 * Three layouts turn up across the archive, and all three are read:
 *
 *   - Since about 2016: a 24-byte volume header, then records, each a
 *     big-endian length followed by a bzip2 stream. The first record holds the
 *     site's metadata; the rest hold 120 radials apiece as message 31.
 *   - 2008 to 2015: the same messages, gzipped as a whole file rather than
 *     bzipped record by record.
 *   - Before 2008: gzipped too, and the radials are the legacy message 1 —
 *     reflectivity on one-kilometre gates and velocity on quarter-kilometre
 *     ones, in fixed 2432-byte frames.
 *
 * Every message is preceded by a 12-byte header left over from the radar's
 * old tape drives, then a 16-byte message header. Message 31 is as long as it
 * says it is; everything else fills a 2432-byte frame.
 *
 * Only the three moments the app draws are kept: reflectivity, radial
 * velocity and the correlation coefficient. The other moments are 16-bit or
 * not drawn, and are skipped without being copied.
 */

export type Moment = "REF" | "VEL" | "RHO";
export const MOMENTS: readonly Moment[] = ["REF", "VEL", "RHO"];

/** One moment along one radial. */
export interface Gates {
  /** Metres from the radar to the centre of the first gate. */
  first: number;
  /** Metres between gate centres. */
  spacing: number;
  /** value = (code - offset) / scale. Codes 0 and 1 are "nothing" and "range folded". */
  scale: number;
  offset: number;
  data: Uint8Array;
}

/** One ray of one scan. */
export interface Radial {
  /** Epoch milliseconds the radial was collected. */
  time: number;
  /** Degrees clockwise from true north. */
  az: number;
  /** The cut's number within the volume, from 1. */
  elev: number;
  /** Degrees above the horizon. */
  angle: number;
  /** 0 start of cut, 1 middle, 2 end of cut, 3 start of volume, 4 end of volume. */
  status: number;
  /** 0.5 or 1 degree: how wide the radials of this cut are. */
  width: number;
  moments: Partial<Record<Moment, Gates>>;
  /** Metres per second at which velocity folds, when the radial says. */
  nyquist?: number;
  /** Where the radar is, when the radial carries it (message 31 does). */
  site?: { lat: number; lon: number; height: number };
}

export const FRAME = 2432;
const CTM = 12;
const HEADER = 16;

/** The 24-byte volume header: "AR2V0006.123" or "ARCHIVE2.123", then date, time and site. */
export interface VolumeHeader {
  version: string;
  /** Epoch milliseconds the volume began. */
  time: number;
  site: string;
  /** True when records follow as bzip2 streams; false when messages follow directly. */
  bzipped: boolean;
}

const text = (b: Uint8Array, from: number, n: number) => {
  let s = "";
  for (let i = 0; i < n; i += 1) s += String.fromCharCode(b[from + i] ?? 0);
  return s;
};

/** Modified Julian date (1 = 1 January 1970) and milliseconds of the day, to epoch ms. */
export const epochOf = (mjd: number, ms: number) => (mjd - 1) * 86_400_000 + ms;

export function readVolumeHeader(b: Uint8Array): VolumeHeader | null {
  if (b.length < 24) return null;
  const tag = text(b, 0, 8);
  if (tag !== "ARCHIVE2" && !tag.startsWith("AR2V")) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const header: VolumeHeader = {
    version: text(b, 0, 12),
    time: epochOf(v.getUint32(12), v.getUint32(16)),
    site: text(b, 20, 4).trim(),
    bzipped: false,
  };
  // A bzip2 record starts with its length and then the stream's own "BZh".
  if (b.length >= 31) header.bzipped = text(b, 28, 3) === "BZh";
  return header;
}

/**
 * The next bzip2 record after `from`, or null until its bytes have all
 * arrived. The length is signed; the last record of a volume is negative.
 */
export function nextRecord(
  b: Uint8Array,
  from: number,
): { start: number; end: number } | null {
  if (from + 4 > b.length) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const size = Math.abs(v.getInt32(from));
  if (size === 0) return null;
  const start = from + 4;
  const end = start + size;
  return end <= b.length ? { start, end } : null;
}

/**
 * Walk a run of messages, handing each radial to `take`, and return where the
 * walk stopped — the first message whose bytes have not all arrived, so a
 * streaming reader can come back with more and carry on from there.
 */
export function walkMessages(
  b: Uint8Array,
  from: number,
  take: (r: Radial) => void,
): number {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let at = from;
  while (at + CTM + HEADER <= b.length) {
    const halfwords = v.getUint16(at + CTM);
    const type = b[at + CTM + 3]!;
    const length = type === 31 ? CTM + halfwords * 2 : FRAME;
    if (type === 31 && halfwords < 8) return b.length; // corrupt; nothing sensible follows
    if (at + length > b.length) break;
    const body = at + CTM + HEADER;
    if (type === 31) {
      const r = readMessage31(b, v, body, at + length);
      if (r) take(r);
    } else if (type === 1) {
      const r = readMessage1(b, v, body);
      if (r) take(r);
    }
    at += length;
  }
  return at;
}

const MOMENT_BLOCKS: Record<string, Moment> = {
  REF: "REF",
  VEL: "VEL",
  RHO: "RHO",
};

/** Message 31, "digital radar data generic format", since 2008. */
function readMessage31(
  b: Uint8Array,
  v: DataView,
  body: number,
  end: number,
): Radial | null {
  if (body + 32 > end) return null;
  const ms = v.getUint32(body + 4);
  const mjd = v.getUint16(body + 8);
  const radial: Radial = {
    time: epochOf(mjd, ms),
    az: v.getFloat32(body + 12),
    elev: b[body + 22]!,
    angle: v.getFloat32(body + 24),
    status: b[body + 21]!,
    width: b[body + 20] === 1 ? 0.5 : 1,
    moments: {},
  };
  const blocks = Math.min(v.getUint16(body + 30), 10);
  for (let i = 0; i < blocks; i += 1) {
    const at = body + 32 + i * 4;
    if (at + 4 > end) break;
    const ptr = v.getUint32(at);
    if (!ptr) continue;
    const p = body + ptr;
    if (p + 28 > end) continue;
    const kind = text(b, p + 1, 3);
    if (b[p] === 0x52 /* R */) {
      if (kind === "VOL" && p + 20 <= end) {
        radial.site = {
          lat: v.getFloat32(p + 8),
          lon: v.getFloat32(p + 12),
          height: v.getUint16(p + 16),
        };
      } else if (kind === "RAD" && p + 18 <= end) {
        radial.nyquist = v.getUint16(p + 16) / 100;
      }
      continue;
    }
    const moment = MOMENT_BLOCKS[kind];
    if (!moment || b[p + 19] !== 8) continue;
    const n = v.getUint16(p + 8);
    if (p + 28 + n > end) continue;
    radial.moments[moment] = {
      first: v.getInt16(p + 10),
      spacing: v.getInt16(p + 12),
      scale: v.getFloat32(p + 20),
      offset: v.getFloat32(p + 24),
      data: b.subarray(p + 28, p + 28 + n),
    };
  }
  return radial;
}

/** Message 1, the legacy radial, before 2008. Angles are coded in 1/32768ths of a half turn. */
function readMessage1(b: Uint8Array, v: DataView, body: number): Radial | null {
  const end = body + FRAME - CTM - HEADER;
  if (end > b.length) return null;
  const coded = (n: number) => (n * 180) / 32768;
  const radial: Radial = {
    time: epochOf(v.getUint16(body + 4), v.getUint32(body)),
    az: coded(v.getUint16(body + 8)),
    status: v.getUint16(body + 12),
    angle: coded(v.getUint16(body + 14)),
    elev: v.getUint16(body + 16),
    width: 1,
    moments: {},
  };
  const nyquist = v.getInt16(body + 60);
  if (nyquist > 0) radial.nyquist = nyquist / 100;

  const surveillanceGates = v.getUint16(body + 26);
  const dopplerGates = v.getUint16(body + 28);
  const refAt = v.getUint16(body + 36);
  const velAt = v.getUint16(body + 38);
  if (refAt && surveillanceGates && body + refAt + surveillanceGates <= end) {
    radial.moments.REF = {
      first: v.getInt16(body + 18),
      spacing: v.getUint16(body + 22),
      scale: 2,
      offset: 66,
      data: b.subarray(body + refAt, body + refAt + surveillanceGates),
    };
  }
  if (velAt && dopplerGates && body + velAt + dopplerGates <= end) {
    radial.moments.VEL = {
      first: v.getInt16(body + 20),
      spacing: v.getUint16(body + 24),
      // Resolution code 4 is whole metres per second; 2 is halves.
      scale: v.getUint16(body + 42) === 4 ? 1 : 2,
      offset: 129,
      data: b.subarray(body + velAt, body + velAt + dopplerGates),
    };
  }
  return radial;
}
