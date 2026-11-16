/**
 * A small GRIB2 reader for the records the model viewer draws: one message (one field),
 * on a regular lat/lon grid (template 3.0, GFS) or Lambert conformal (3.30, HRRR and
 * REFS), packed simply (5.0) or with complex packing and spatial differencing (5.2/5.3,
 * which is what NCEP uses). Values come back as a Float32Array in the file's own scan
 * order; NaN where the field is missing.
 */

export type LatLonGrid = {
  kind: "latlon";
  ni: number;
  nj: number;
  lat1: number;
  lon1: number;
  di: number;
  dj: number;
  /** True when rows run north to south. */
  southward: boolean;
};
export type LambertGrid = {
  kind: "lambert";
  nx: number;
  ny: number;
  lat1: number;
  lon1: number;
  lov: number;
  latin1: number;
  latin2: number;
  lad: number;
  dx: number;
  dy: number;
  radius: number;
};
export type Grid = LatLonGrid | LambertGrid;
export type Field = { grid: Grid; values: Float32Array };

/** Sign-magnitude integers, as GRIB2 stores every signed number. */
function sm(b: Uint8Array, o: number, n: number) {
  let v = b[o] & 0x7f;
  for (let i = 1; i < n; i++) v = v * 256 + b[o + i];
  return b[o] & 0x80 ? -v : v;
}
function u(b: Uint8Array, o: number, n: number) {
  let v = 0;
  for (let i = 0; i < n; i++) v = v * 256 + b[o + i];
  return v;
}

class Bits {
  private pos = 0;
  constructor(
    private b: Uint8Array,
    start: number,
  ) {
    this.pos = start * 8;
  }
  /** The next n bits as an unsigned number, taken a byte (or what is left of one) at a time. */
  read(n: number) {
    let v = 0;
    let p = this.pos;
    while (n > 0) {
      const room = 8 - (p & 7);
      const take = n < room ? n : room;
      v =
        v * (1 << take) +
        ((this.b[p >> 3] >> (room - take)) & ((1 << take) - 1));
      p += take;
      n -= take;
    }
    this.pos = p;
    return v;
  }
  align() {
    this.pos = Math.ceil(this.pos / 8) * 8;
  }
}

function parseGrid(s: Uint8Array): Grid {
  const tpl = u(s, 12, 2);
  if (tpl === 0) {
    const scan = s[71];
    const lat1 = sm(s, 46, 4) / 1e6;
    const lat2 = sm(s, 55, 4) / 1e6;
    return {
      kind: "latlon",
      ni: u(s, 30, 4),
      nj: u(s, 34, 4),
      lat1,
      lon1: u(s, 50, 4) / 1e6,
      di: u(s, 63, 4) / 1e6,
      dj: u(s, 67, 4) / 1e6,
      southward: scan & 0x40 ? false : lat1 > lat2,
    };
  }
  if (tpl === 30) {
    const shape = s[14];
    return {
      kind: "lambert",
      nx: u(s, 30, 4),
      ny: u(s, 34, 4),
      lat1: sm(s, 38, 4) / 1e6,
      lon1: u(s, 42, 4) / 1e6,
      lad: sm(s, 47, 4) / 1e6,
      lov: u(s, 51, 4) / 1e6,
      dx: u(s, 55, 4) / 1000,
      dy: u(s, 59, 4) / 1000,
      latin1: sm(s, 65, 4) / 1e6,
      latin2: sm(s, 69, 4) / 1e6,
      radius: shape === 6 ? 6371229 : 6371229,
    };
  }
  throw new Error(`GRIB2 grid template ${tpl} not supported`);
}

function unpack(
  s5: Uint8Array,
  s7: Uint8Array,
  n: number,
): Float64Array | Float32Array {
  const tpl = u(s5, 9, 2);
  const R = new DataView(s5.buffer, s5.byteOffset + 11, 4).getFloat32(0);
  const E = sm(s5, 15, 2);
  const D = sm(s5, 17, 2);
  const nbits = s5[19];
  const out = new Float32Array(n);
  const e2 = 2 ** E;
  const d10 = 10 ** D;
  const scale = (x: number) => (R + x * e2) / d10;
  if (tpl === 0) {
    if (!nbits) return out.fill(R / 10 ** D);
    const bits = new Bits(s7, 5);
    for (let i = 0; i < n; i++) out[i] = scale(bits.read(nbits));
    return out;
  }
  if (tpl !== 2 && tpl !== 3)
    throw new Error(`GRIB2 packing template ${tpl} not supported`);
  const mvm = s5[22];
  const ng = u(s5, 31, 4);
  const wRef = s5[35];
  const wBits = s5[36];
  const lRef = u(s5, 37, 4);
  const lInc = s5[41];
  const lLast = u(s5, 42, 4);
  const lBits = s5[46];
  const order = tpl === 3 ? s5[47] : 0;
  const nDesc = tpl === 3 ? s5[48] : 0;
  let off = 5;
  let ival1 = 0;
  let ival2 = 0;
  let minsd = 0;
  if (order) {
    ival1 = sm(s7, off, nDesc);
    off += nDesc;
    if (order === 2) {
      ival2 = sm(s7, off, nDesc);
      off += nDesc;
    }
    minsd = sm(s7, off, nDesc);
    off += nDesc;
  }
  const bits = new Bits(s7, off);
  const refs = new Array<number>(ng);
  for (let g = 0; g < ng; g++) refs[g] = bits.read(nbits);
  bits.align();
  const widths = new Array<number>(ng);
  for (let g = 0; g < ng; g++) widths[g] = wRef + bits.read(wBits);
  bits.align();
  const lens = new Array<number>(ng);
  for (let g = 0; g < ng; g++) lens[g] = lRef + lInc * bits.read(lBits);
  bits.align();
  lens[ng - 1] = lLast;
  // Raw values per point; NaN for missing.
  const raw = new Float64Array(n);
  let k = 0;
  const allOnesRef = 2 ** nbits - 1;
  for (let g = 0; g < ng && k < n; g++) {
    const w = widths[g];
    const ref = refs[g];
    const ones = 2 ** w - 1;
    for (let i = 0; i < lens[g] && k < n; i++) {
      if (!w) {
        raw[k++] = mvm && ref === allOnesRef ? NaN : ref;
        continue;
      }
      const v = bits.read(w);
      raw[k++] =
        mvm === 1 && v === ones
          ? NaN
          : mvm === 2 && (v === ones || v === ones - 1)
            ? NaN
            : ref + v;
    }
  }
  if (order) {
    // Undo spatial differencing across the non-missing values only.
    let a = 0;
    let b = 0;
    let seen = 0;
    for (let i = 0; i < n; i++) {
      if (Number.isNaN(raw[i])) continue;
      let h: number;
      if (seen === 0) h = ival1;
      else if (seen === 1 && order === 2) h = ival2;
      else if (order === 1) h = raw[i] + minsd + a;
      else h = raw[i] + minsd + 2 * a - b;
      b = a;
      a = h;
      raw[i] = h;
      seen++;
    }
  }
  for (let i = 0; i < n; i++)
    out[i] = Number.isNaN(raw[i]) ? NaN : scale(raw[i]);
  return out;
}

/** Decode the first message in `buf`. */
export function decodeGrib2(buf: Uint8Array): Field {
  if (buf[0] !== 0x47 || buf[1] !== 0x52 || buf[2] !== 0x49 || buf[3] !== 0x42)
    throw new Error("Not a GRIB message");
  let p = 16;
  let grid: Grid | null = null;
  let s5: Uint8Array | null = null;
  let bitmap: Uint8Array | null = null;
  let npts = 0;
  let values: Float32Array | null = null;
  while (p < buf.length - 4) {
    if (buf[p] === 0x37 && buf[p + 1] === 0x37 && buf[p + 2] === 0x37) break;
    const len = u(buf, p, 4);
    const num = buf[p + 4];
    const sec = buf.subarray(p, p + len);
    if (num === 3) {
      grid = parseGrid(sec);
      npts = u(sec, 6, 4);
    } else if (num === 5) s5 = sec;
    else if (num === 6) bitmap = sec[5] === 0 ? sec.subarray(6) : null;
    else if (num === 7 && s5 && grid) {
      const nData = u(s5, 5, 4);
      const packed = unpack(s5, sec, nData);
      if (!bitmap) values = Float32Array.from(packed);
      else {
        values = new Float32Array(npts).fill(NaN);
        let k = 0;
        for (let i = 0; i < npts; i++)
          if ((bitmap[i >> 3] >> (7 - (i & 7))) & 1) values[i] = packed[k++];
      }
      break;
    }
    p += len;
  }
  if (!grid || !values) throw new Error("GRIB message incomplete");
  return { grid, values };
}

/**
 * Fractional grid position (i across, j up the file's rows) for a lat/lon, or null off
 * the grid. HRRR/REFS scan south to north (+i, +j); GFS scans north to south.
 */
export function locator(
  grid: Grid,
): (lat: number, lon: number) => [number, number] {
  if (grid.kind === "latlon") {
    return (lat, lon) => {
      let dl = lon - grid.lon1;
      dl = ((dl % 360) + 360) % 360;
      const i = dl / grid.di;
      const j = grid.southward
        ? (grid.lat1 - lat) / grid.dj
        : (lat - grid.lat1) / grid.dj;
      return [i, j];
    };
  }
  const rad = Math.PI / 180;
  const p1 = grid.latin1 * rad;
  const p2 = grid.latin2 * rad;
  const n =
    Math.abs(p1 - p2) < 1e-9
      ? Math.sin(p1)
      : Math.log(Math.cos(p1) / Math.cos(p2)) /
        Math.log(
          Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2),
        );
  const F = (Math.cos(p1) * Math.tan(Math.PI / 4 + p1 / 2) ** n) / n;
  const rho = (lat: number) =>
    (grid.radius * F) / Math.tan(Math.PI / 4 + (lat * rad) / 2) ** n;
  const rho0 = rho(grid.lad);
  const xy = (lat: number, lon: number) => {
    let d = lon - grid.lov;
    d = ((((d + 180) % 360) + 360) % 360) - 180;
    const r = rho(lat);
    return [r * Math.sin(n * d * rad), rho0 - r * Math.cos(n * d * rad)];
  };
  const [x0, y0] = xy(grid.lat1, grid.lon1);
  return (lat, lon) => {
    const [x, y] = xy(lat, lon);
    return [(x - x0) / grid.dx, (y - y0) / grid.dy];
  };
}

/**
 * The same grid positions `locator` gives, a whole row of pixels at a time (`lons` fixed per
 * map): the trigonometry runs once per row and once per column instead of once per pixel, and
 * nothing is allocated per pixel. Each number is computed with the same operations as
 * `locator`, so a frame painted either way is identical.
 */
export function rowLocator(grid: Grid, lons: Float64Array) {
  const w = lons.length;
  if (grid.kind === "latlon") {
    const fi = new Float64Array(w);
    for (let x = 0; x < w; x++) {
      let dl = lons[x] - grid.lon1;
      dl = ((dl % 360) + 360) % 360;
      fi[x] = dl / grid.di;
    }
    return (lat: number, outI: Float64Array, outJ: Float64Array) => {
      const j = grid.southward
        ? (grid.lat1 - lat) / grid.dj
        : (lat - grid.lat1) / grid.dj;
      outI.set(fi);
      outJ.fill(j);
    };
  }
  const rad = Math.PI / 180;
  const p1 = grid.latin1 * rad;
  const p2 = grid.latin2 * rad;
  const n =
    Math.abs(p1 - p2) < 1e-9
      ? Math.sin(p1)
      : Math.log(Math.cos(p1) / Math.cos(p2)) /
        Math.log(
          Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2),
        );
  const F = (Math.cos(p1) * Math.tan(Math.PI / 4 + p1 / 2) ** n) / n;
  const rho = (lat: number) =>
    (grid.radius * F) / Math.tan(Math.PI / 4 + (lat * rad) / 2) ** n;
  const rho0 = rho(grid.lad);
  const angle = (lon: number) => {
    let d = lon - grid.lov;
    d = ((((d + 180) % 360) + 360) % 360) - 180;
    return n * d * rad;
  };
  const r1 = rho(grid.lat1);
  const x0 = r1 * Math.sin(angle(grid.lon1));
  const y0 = rho0 - r1 * Math.cos(angle(grid.lon1));
  const sin = new Float64Array(w);
  const cos = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    const a = angle(lons[x]);
    sin[x] = Math.sin(a);
    cos[x] = Math.cos(a);
  }
  const { dx, dy } = grid;
  return (lat: number, outI: Float64Array, outJ: Float64Array) => {
    const r = rho(lat);
    for (let x = 0; x < w; x++) {
      outI[x] = (r * sin[x] - x0) / dx;
      outJ[x] = (rho0 - r * cos[x] - y0) / dy;
    }
  };
}

/** The inverse of `locator`: the lat/lon of grid position (i, j). */
export function latLonOf(
  grid: Grid,
): (i: number, j: number) => [number, number] {
  if (grid.kind === "latlon")
    return (i, j) => [
      grid.southward ? grid.lat1 - j * grid.dj : grid.lat1 + j * grid.dj,
      ((((grid.lon1 + i * grid.di + 180) % 360) + 360) % 360) - 180,
    ];
  const rad = Math.PI / 180;
  const p1 = grid.latin1 * rad;
  const p2 = grid.latin2 * rad;
  const n =
    Math.abs(p1 - p2) < 1e-9
      ? Math.sin(p1)
      : Math.log(Math.cos(p1) / Math.cos(p2)) /
        Math.log(
          Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2),
        );
  const F = (Math.cos(p1) * Math.tan(Math.PI / 4 + p1 / 2) ** n) / n;
  const rho = (lat: number) =>
    (grid.radius * F) / Math.tan(Math.PI / 4 + (lat * rad) / 2) ** n;
  const rho0 = rho(grid.lad);
  let d0 = grid.lon1 - grid.lov;
  d0 = ((((d0 + 180) % 360) + 360) % 360) - 180;
  const r1 = rho(grid.lat1);
  const x0 = r1 * Math.sin(n * d0 * rad);
  const y0 = rho0 - r1 * Math.cos(n * d0 * rad);
  return (i, j) => {
    const x = x0 + i * grid.dx;
    const y = rho0 - (y0 + j * grid.dy);
    const r = Math.sign(n) * Math.hypot(x, y);
    const th = Math.atan2(Math.sign(n) * x, Math.sign(n) * y);
    const lat =
      (2 * Math.atan(((grid.radius * F) / r) ** (1 / n)) - Math.PI / 2) / rad;
    const lon = grid.lov + th / n / rad;
    return [lat, ((((lon + 180) % 360) + 360) % 360) - 180];
  };
}

export const gridSize = (g: Grid) =>
  g.kind === "latlon" ? [g.ni, g.nj] : [g.nx, g.ny];
