import { RADAR_STOPS } from "@/features/replay/palette";
/**
 * Turning IEM's colours back into reflectivity, and reflectivity into ours.
 *
 * The archive transmits dBZ as a palette index and the index as a colour. So
 * the first thing this does is throw the colour away: an RGB pixel is looked
 * up in a reverse table to recover the index, and the index is the
 * measurement. What comes out is a single byte of data per pixel, which is
 * uploaded as a texture and coloured on the GPU by the palette below.
 *
 * Doing it this way rather than drawing IEM's picture at some opacity is what
 * the owner asked for, and it is also the only way to control what the low
 * values look like — which is the whole of #14.
 */
import { N0Q_PALETTE_B64, dbzForIndex } from "./palette";

/** Index 0 carries "nothing here", and must never be drawn as -32 dBZ. */
export const NO_DATA = 0;

function paletteBytes(): Uint8Array {
  const bin = atob(N0Q_PALETTE_B64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * RGB to palette index, as a flat 24-bit table.
 *
 * Sixteen million entries of one byte is 16 MB, which is too much to hold for
 * a feature that is off by default. A Map of packed RGB keys is a few hundred
 * kilobytes and the lookup is O(1) either way — the tile is only 65,536
 * pixels, so this is never the slow part.
 */
let reverse: Map<number, number> | null = null;

export function reverseTable(): Map<number, number> {
  if (reverse) return reverse;
  const pal = paletteBytes();
  const m = new Map<number, number>();
  for (let i = 0; i < 256; i += 1) {
    m.set((pal[i * 3]! << 16) | (pal[i * 3 + 1]! << 8) | pal[i * 3 + 2]!, i);
  }
  reverse = m;
  return m;
}

/**
 * One tile's pixels, decoded from IEM's colours to palette indices.
 *
 * A pixel whose colour is not in the palette — which should not happen, and
 * did not in any tile I checked — is treated as no data rather than as the
 * nearest match, because inventing a reflectivity is worse than a gap.
 * Transparent pixels are no data by definition.
 */
export function decodeTile(rgba: Uint8ClampedArray | Uint8Array): Uint8Array {
  const table = reverseTable();
  const out = new Uint8Array(rgba.length / 4);
  for (let p = 0, q = 0; p < rgba.length; p += 4, q += 1) {
    if (rgba[p + 3]! < 8) {
      out[q] = NO_DATA;
      continue;
    }
    const key = (rgba[p]! << 16) | (rgba[p + 1]! << 8) | rgba[p + 2]!;
    out[q] = table.get(key) ?? NO_DATA;
  }
  return out;
}

/**
 * The chaser palette.
 *
 * The National Weather Service palette is built for a forecaster reading a
 * whole screen of weather: it starts at -32 dBZ and gives the light returns
 * as much colour as the heavy ones, so a supercell arrives inside a wash of
 * green that hides where the core is. A chaser is looking for one thing —
 * where the strong stuff is, and what shape it is — and everything below
 * about twenty dBZ is in the way of seeing it.
 *
 * So the low end is muted rather than coloured: near-transparent and almost
 * grey up to 20 dBZ, so light rain reads as texture on the ground instead of
 * as a green field. Colour begins where precipitation begins to mean
 * something, and the top end is deliberately steep, because the difference
 * between 55 and 65 dBZ is the difference between rain and hail you do not
 * drive through.
 *
 * Stops are [dBZ, r, g, b, a]. Everything between them is interpolated, so
 * this is a shape rather than a list of bands.
 *
 * The stops sit exactly on the values the legend labels — 20, 30, 40, 50, 60,
 * 70 — and that is not tidiness, it is what makes the ramp readable. With
 * stops at 38 and 45 instead, the colour at 40 dBZ was whatever fell out of
 * the interpolation, and what fell out was a yellow-green that measured only
 * 3.4 from the orange at 50 under deutan and 13.9 with full colour vision.
 * Forty and fifty dBZ are rain and a core; a chaser has to be able to tell
 * them apart. With the stops on the labels the worst adjacent pair measures
 * 18.5 under colour blindness and 20.4 otherwise, and the low end came out
 * more muted rather than less.
 */
export const chaserStops = (): [number, number, number, number, number][] =>
  RADAR_STOPS.map(([d, hex, a]) => {
    const n = parseInt(hex.slice(1), 16);
    return [d, n >> 16, (n >> 8) & 255, n & 255, a];
  });

/**
 * The ramp evaluated at one reflectivity, on the CPU.
 *
 * The shader generates the same ramp from the same stops, so this is not a
 * second implementation of the palette — it is the one the legend draws its
 * swatches from and the one the tests assert on, which is what keeps the
 * scale beside the map honest about the pixels on it.
 */
export function chaserAt(dbz: number): {
  r: number;
  g: number;
  b: number;
  a: number;
} {
  const CHASER_STOPS = chaserStops();
  let lo = CHASER_STOPS[0]!;
  let hi = CHASER_STOPS[CHASER_STOPS.length - 1]!;
  for (let s = 0; s < CHASER_STOPS.length - 1; s += 1) {
    if (dbz >= CHASER_STOPS[s]![0] && dbz <= CHASER_STOPS[s + 1]![0]) {
      lo = CHASER_STOPS[s]!;
      hi = CHASER_STOPS[s + 1]!;
      break;
    }
  }
  const span = hi[0] - lo[0];
  const f = span === 0 ? 0 : Math.max(0, Math.min(1, (dbz - lo[0]) / span));
  const mix = (a: number, b: number) => a + (b - a) * f;
  return {
    r: Math.round(mix(lo[1], hi[1])),
    g: Math.round(mix(lo[2], hi[2])),
    b: Math.round(mix(lo[3], hi[3])),
    a: mix(lo[4], hi[4]),
  };
}

/** The whole ramp as 256 RGBA bytes, one per palette index — for the tests. */
export function buildPaletteTexture(): Uint8Array {
  const out = new Uint8Array(256 * 4);
  for (let i = 1; i < 256; i += 1) {
    const c = chaserAt(dbzForIndex(i));
    out[i * 4] = c.r;
    out[i * 4 + 1] = c.g;
    out[i * 4 + 2] = c.b;
    out[i * 4 + 3] = Math.round(255 * c.a);
  }
  // Index 0 is no data and is fully transparent, never a colour.
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  return out;
}

/** For the legend: the dBZ values worth labelling, and their colours. */
export const LEGEND_STOPS = [20, 30, 40, 50, 60, 70] as const;
