// @vitest-environment node
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decompress } from "bz2";
import {
  epochOf,
  FRAME,
  nextRecord,
  readVolumeHeader,
  walkMessages,
  type Radial,
} from "@/features/replay/radar/level2/format";
import {
  buildSweep,
  LowestScan,
  valueOf,
} from "@/features/replay/radar/level2/sweep";
import {
  dayPrefix,
  parseListing,
  pickVolume,
  volumeFromKey,
  type VolumeRef,
} from "@/features/replay/radar/level2/volumes";
import {
  kmBetween,
  nearestSites,
  SITES,
} from "@/features/replay/radar/level2/sites";
import {
  ccStops,
  rampAt,
  rampFunction,
  velocityStops,
} from "@/features/replay/radar/level2/palettes";

const VELOCITY_STOPS = velocityStops();
const CC_STOPS = ccStops();
import { readLowestScan } from "@/features/replay/radar/level2/scan";

/**
 * One bzip2 record, made with Python's bz2 module from hand-built messages:
 * a metadata frame, two radials of cut 1 (reflectivity, a 16-bit ZDR that
 * must be skipped, correlation, the site's position) and one of cut 2
 * (velocity) to check fields by; then a small scan of 36 radials a cut, and
 * the antenna rising to its next angle. Small enough to read, real enough to
 * decode.
 */
const RECORD =
  "QlpoOTFBWSZTWYcdK7gAAL////90RQTlVEQd//6dFGcSc1F0hLM4UhGESFBAAAQhBFKYUAM+oAGjoBCUD9UAAAAAAAAAAAAAAAAhUAD9UAAaAANAAGgAAAAAAAg//VUAAATABMAEwAAJiMBGRgEwTA4NGjQNBoDJiAyNDIAA00yAAAYIABSko0qfkp6j1PUhoyaH6kabSBp+pqDJ6jQGmmNTQeptTZT1NM0elM/n8Xn+6vUlpNLUtR1+vI9gjrI01rsAQARJpr9tpNp4gIxERE+LOAiAXfogIAvuJzCIAHcxwYdv1dvJH2fD6e+qhm73/1SP8yNkZkUb+pI+71FHsJG3XzEa/jxI7vORvT7QmFCfYyqXP1lGpR8cjJTjkT1iMBHaDMKtxRoo/7lJPVz9ij2/058Hc7m5DuEeVSPyZ5ajzpHXrdKP7kfDqR62KPQExCvdRWRwz7+YRrRRijz9NVHNWFY0la1WFYyRrMoV9bFFakYjNmKl1bqj0BPeEwjCPcUe3wNqjIV7XTmEZhGYR5fKRskczOGNMRXi73+vj7/V4PD/zxcuXLly5cuXLl2Eev5jRHdd26NYke9s39O9rc3xHv6bWxQww4nBtg2jgm7uHIiIiIiIiInwAIgCsQRgIgC0+ArDwhlRhYoxDfIwvqKO/8HOR3vi4pGSM5qjvyO9UfJ9Ej0nAjhI9Nr8Ao6CjjI/xt0org9LLMszMzMwAAAAAAAAAAAAAAAAMzMzMzMKOiR5n6+dzqNFH9MkfL7JR4CjwFG+Rw5tZxcvk8Pi3tiPlkadLxyPn9rg2f+I/R2/n/f9Hb222222/Hdrq5nRUYY6FGnqKPNI8e6o/hFG7RwcXaCbjx43uPLs4yPIo7PD8PE1I2I7OcRved5rpUdkjykV5CPq75G6P/i7kinChIQ46V3A";
const record = () => new Uint8Array(Buffer.from(RECORD, "base64"));

const radialsOf = (bytes: Uint8Array) => {
  const out: Radial[] = [];
  walkMessages(bytes, 0, (r) => out.push(r));
  return out;
};

/** A legacy message-1 frame, as radars wrote them before 2008. */
function message1(o: {
  az: number;
  angle: number;
  elev: number;
  ref?: number[];
  vel?: number[];
  ms?: number;
  nyquist?: number;
  wholeMs?: boolean;
}): Uint8Array {
  const f = new Uint8Array(FRAME);
  const v = new DataView(f.buffer);
  v.setUint16(12, 1208);
  f[15] = 1;
  const b = 28;
  const code = (deg: number) => Math.round((deg * 32768) / 180);
  v.setUint32(b, o.ms ?? 3_600_000);
  v.setUint16(b + 4, 10_715); // 1999-05-03
  v.setUint16(b + 8, code(o.az));
  v.setUint16(b + 14, code(o.angle));
  v.setUint16(b + 16, o.elev);
  v.setInt16(b + 18, 0);
  v.setInt16(b + 20, -375);
  v.setUint16(b + 22, 1000);
  v.setUint16(b + 24, 250);
  v.setUint16(b + 26, o.ref?.length ?? 0);
  v.setUint16(b + 28, o.vel?.length ?? 0);
  if (o.ref) {
    v.setUint16(b + 36, 100);
    f.set(o.ref, b + 100);
  }
  if (o.vel) {
    v.setUint16(b + 38, 1000);
    f.set(o.vel, b + 1000);
  }
  v.setUint16(b + 42, o.wholeMs ? 4 : 2);
  v.setInt16(b + 60, Math.round((o.nyquist ?? 26.1) * 100));
  return f;
}

function volumeHeader(tag: string, site: string): Uint8Array {
  const h = new Uint8Array(24);
  for (let i = 0; i < 12; i += 1) h[i] = tag.charCodeAt(i) || 0;
  const v = new DataView(h.buffer);
  v.setUint32(12, 19_865);
  v.setUint32(16, 72_000_000);
  for (let i = 0; i < 4; i += 1) h[20 + i] = site.charCodeAt(i) || 0x20;
  return h;
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

describe("reading Level II messages", () => {
  it("decodes message 31: angles, moments, the site and the Nyquist velocity", () => {
    const [a, b, c] = radialsOf(decompress(record(), true));
    expect(a!.az).toBeCloseTo(10.25, 5);
    expect(a!.elev).toBe(1);
    expect(a!.angle).toBeCloseTo(0.48, 5);
    expect(a!.width).toBe(0.5);
    expect(a!.time).toBe(epochOf(19_865, 72_000_000));
    expect(new Date(a!.time).toISOString()).toBe("2024-05-21T20:00:00.000Z");
    expect(a!.site!.lat).toBeCloseTo(41.7312, 3);
    expect(a!.site!.lon).toBeCloseTo(-93.7229, 3);
    expect(a!.nyquist).toBeCloseTo(8.85, 2);
    const ref = a!.moments.REF!;
    expect(ref).toMatchObject({
      first: 2125,
      spacing: 250,
      scale: 2,
      offset: 66,
    });
    expect([...ref.data]).toEqual([0, 1, 66, 76, 200]);
    expect(valueOf(ref, 76)).toBe(5);
    // The 16-bit ZDR is not one of ours, and is skipped rather than misread as bytes.
    expect(Object.keys(a!.moments)).toEqual(["REF"]);
    expect(valueOf(b!.moments.RHO!, 240)).toBeCloseTo((240 + 60.5) / 300, 6);
    expect(c!.elev).toBe(2);
    expect(valueOf(c!.moments.VEL!, 149)).toBe(10);
    expect(valueOf(c!.moments.VEL!, 109)).toBe(-10);
  });

  it("reads the legacy message 1, with whole-metre velocity when the radial says so", () => {
    const [r] = radialsOf(
      message1({
        az: 123.4,
        angle: 0.5,
        elev: 1,
        ref: [0, 86, 106],
        vel: [129, 139, 1],
      }),
    );
    expect(r!.az).toBeCloseTo(123.4, 1);
    expect(r!.angle).toBeCloseTo(0.5, 2);
    expect(r!.moments.REF).toMatchObject({
      first: 0,
      spacing: 1000,
      scale: 2,
      offset: 66,
    });
    expect(valueOf(r!.moments.REF!, 106)).toBe(20);
    expect(r!.moments.VEL).toMatchObject({
      first: -375,
      spacing: 250,
      scale: 2,
      offset: 129,
    });
    expect(r!.nyquist).toBeCloseTo(26.1, 2);
    const [w] = radialsOf(
      message1({ az: 1, angle: 0.5, elev: 2, vel: [139], wholeMs: true }),
    );
    expect(valueOf(w!.moments.VEL!, 139)).toBe(10);
  });

  it("stops before a message that has not fully arrived, so a stream can carry on", () => {
    const one = message1({ az: 1, angle: 0.5, elev: 1, ref: [90] });
    const two = message1({ az: 2, angle: 0.5, elev: 1, ref: [91] });
    const partial = concat(one, two.subarray(0, 1000));
    const seen: Radial[] = [];
    expect(walkMessages(partial, 0, (r) => seen.push(r))).toBe(FRAME);
    expect(seen).toHaveLength(1);
  });

  it("knows a bzipped volume from a plain one by its header", () => {
    const bz = concat(
      volumeHeader("AR2V0006.700", "KDMX"),
      new Uint8Array([0, 0, 1, 44]),
      record(),
    );
    const h = readVolumeHeader(bz)!;
    expect(h).toMatchObject({
      version: "AR2V0006.700",
      site: "KDMX",
      bzipped: true,
    });
    expect(new Date(h.time).toISOString()).toBe("2024-05-21T20:00:00.000Z");
    const plain = concat(
      volumeHeader("ARCHIVE2.349", ""),
      message1({ az: 1, angle: 0.5, elev: 1 }),
    );
    expect(readVolumeHeader(plain)!.bzipped).toBe(false);
    expect(
      readVolumeHeader(
        new TextEncoder().encode('<?xml version="1.0"?><Error>…'),
      ),
    ).toBeNull();
  });

  it("finds bzip2 records by their lengths, including the negative last one", () => {
    const b = new Uint8Array(20);
    new DataView(b.buffer).setInt32(0, 6);
    new DataView(b.buffer).setInt32(10, -6);
    expect(nextRecord(b, 0)).toEqual({ start: 4, end: 10 });
    expect(nextRecord(b, 10)).toEqual({ start: 14, end: 20 });
    expect(nextRecord(b.subarray(0, 18), 10)).toBeNull();
  });
});

describe("laying a scan out for the GPU", () => {
  const ray = (az: number, data: number[], elev = 1, angle = 0.5): Radial => ({
    time: 0,
    az,
    elev,
    angle,
    status: 1,
    width: 0.5,
    moments: {
      REF: {
        first: 2125,
        spacing: 250,
        scale: 2,
        offset: 66,
        data: new Uint8Array(data),
      },
    },
  });

  it("puts each row at a fixed bearing and gives it the nearest radial", () => {
    const rays = Array.from({ length: 720 }, (_, i) =>
      ray(i * 0.5 + 0.25, [(i % 250) + 2, 7]),
    );
    const s = buildSweep(rays, "REF")!;
    expect(s.rows).toBe(720);
    expect(s.gates).toBe(2);
    // Row 90 covers 45.0–45.5°, whose radial is centred on 45.25°.
    expect(s.data[90 * 2]).toBe((90 % 250) + 2);
    expect(s.data[90 * 2 + 1]).toBe(7);
  });

  it("leaves a gap in the scan as a gap, rather than smearing a neighbour across it", () => {
    const rays = Array.from({ length: 720 }, (_, i) => i * 0.5)
      .filter((az) => az < 100 || az > 110)
      .map((az) => ray(az + 0.25, [99]));
    const s = buildSweep(rays, "REF")!;
    expect(s.data[Math.floor(105 / 0.5) * s.gates]).toBe(0);
    expect(s.data[Math.floor(50 / 0.5) * s.gates]).toBe(99);
  });

  it("takes each moment from the first cut that carries it, and stops when the antenna rises", () => {
    const scan = new LowestScan();
    const withMoments = (r: Radial, moments: Radial["moments"]): Radial => ({
      ...r,
      moments,
    });
    const g = {
      first: 2125,
      spacing: 250,
      scale: 2,
      offset: 66,
      data: new Uint8Array([100]),
    };
    for (let i = 0; i < 20; i += 1) {
      scan.add(
        withMoments(ray(i * 18, []), {
          REF: g,
          RHO: { ...g, scale: 300, offset: -60.5 },
        }),
      );
    }
    for (let i = 0; i < 20; i += 1)
      scan.add(
        withMoments(ray(i * 18, [], 2, 0.5), {
          REF: g,
          VEL: { ...g, offset: 129 },
        }),
      );
    expect(scan.done).toBe(false);
    scan.add(withMoments(ray(0, [], 3, 0.9), { REF: g }));
    expect(scan.done).toBe(true);
    // Late radials — a SAILS repeat of the bottom, say — change nothing.
    scan.add(withMoments(ray(0, [], 9, 0.5), { REF: g }));
    const sweeps = scan.sweeps();
    expect(sweeps.REF!.elev).toBe(1);
    expect(sweeps.RHO!.elev).toBe(1);
    expect(sweeps.VEL!.elev).toBe(2);
    expect(sweeps.VEL!.rows).toBe(720); // half-degree radials, however few
  });
});

describe("finding a volume in the archive", () => {
  it("reads a volume's site and start from its key, and skips model-data files", () => {
    expect(
      volumeFromKey("2024/05/21/KDMX/KDMX20240521_203103_V06"),
    ).toMatchObject({
      site: "KDMX",
      time: Date.UTC(2024, 4, 21, 20, 31, 3) / 1000,
      gz: false,
      url: "https://unidata-nexrad-level2.s3.amazonaws.com/2024/05/21/KDMX/KDMX20240521_203103_V06",
    });
    expect(
      volumeFromKey("1999/05/03/KTLX/KTLX19990503_235859.gz"),
    ).toMatchObject({ site: "KTLX", gz: true });
    expect(
      volumeFromKey("2011/04/27/KBMX/KBMX20110427_220124_V03.gz")!.gz,
    ).toBe(true);
    expect(
      volumeFromKey("2024/05/21/KDMX/KDMX20240521_205827_V06_MDM"),
    ).toBeNull();
  });

  it("lists by UTC day", () => {
    expect(dayPrefix("KDMX", Date.UTC(2024, 4, 21, 23, 59) / 1000)).toBe(
      "2024/05/21/KDMX/",
    );
    expect(dayPrefix("KDMX", Date.UTC(2024, 4, 22, 0, 1) / 1000)).toBe(
      "2024/05/22/KDMX/",
    );
  });

  it("parses a listing, and follows its continuation", () => {
    const xml =
      "<ListBucketResult><IsTruncated>true</IsTruncated><Contents><Key>a/KDMX20240521_200338_V06</Key>" +
      "</Contents><NextContinuationToken>abc=</NextContinuationToken></ListBucketResult>";
    expect(parseListing(xml)).toEqual({
      keys: ["a/KDMX20240521_200338_V06"],
      next: "abc=",
    });
    expect(parseListing("<IsTruncated>false</IsTruncated>").next).toBeNull();
  });

  it("chooses the volume whose lowest scan is nearest the moment, and none if all are far", () => {
    const at = (h: number, m: number, s: number) =>
      Date.UTC(2024, 4, 21, h, m, s) / 1000;
    const list = [at(20, 3, 38), at(20, 10, 32), at(20, 17, 27)].map(
      (t) => ({ time: t }) as VolumeRef,
    );
    expect(pickVolume(list, at(20, 10, 0))!.time).toBe(at(20, 10, 32));
    expect(pickVolume(list, at(20, 7, 0))!.time).toBe(at(20, 3, 38));
    expect(pickVolume(list, at(21, 0, 0))).toBeNull();
  });
});

describe("the network", () => {
  it("knows every site once, with a sensible position", () => {
    expect(new Set(SITES.map((s) => s.id)).size).toBe(SITES.length);
    expect(SITES.length).toBeGreaterThan(150);
    for (const s of SITES) {
      expect(s.id).toMatch(/^[KPT][A-Z]{3}$/);
      expect(Math.abs(s.lat)).toBeLessThan(72);
    }
  });

  it("finds the radar nearest a tornado", () => {
    // Greenfield, Iowa: Des Moines is 75 km away, Omaha further.
    const [first, second] = nearestSites(41.305, -94.461, 2);
    expect(first!.id).toBe("KDMX");
    expect(first!.km).toBeGreaterThan(60);
    expect(first!.km).toBeLessThan(90);
    expect(second!.km).toBeGreaterThan(first!.km);
    // Moore, 1999: Twin Lakes.
    expect(nearestSites(35.33, -97.49, 1)[0]!.id).toBe("KTLX");
  });

  it("measures great circles", () => {
    expect(kmBetween(0, 0, 0, 1)).toBeCloseTo(111.19, 1);
  });
});

describe("the palettes", () => {
  it("generate a shader ramp that has every stop in it", () => {
    const glsl = rampFunction("velocity", VELOCITY_STOPS);
    expect(glsl).toMatch(/^vec4 velocity\(float v\) \{/);
    expect(glsl.match(/if \(v < /g)).toHaveLength(VELOCITY_STOPS.length - 1);
  });

  it("read green towards the radar, red away, and grey at rest", () => {
    const inbound = rampAt(VELOCITY_STOPS, -30);
    const outbound = rampAt(VELOCITY_STOPS, 30);
    const still = rampAt(VELOCITY_STOPS, 0);
    expect(inbound.g).toBeGreaterThan(inbound.r * 2);
    expect(outbound.r).toBeGreaterThan(outbound.g * 2);
    expect(
      Math.max(still.r, still.g, still.b) - Math.min(still.r, still.g, still.b),
    ).toBeLessThan(8);
  });

  it("put debris in blues and rain in warm colours", () => {
    const debris = rampAt(CC_STOPS, 0.6);
    const rain = rampAt(CC_STOPS, 0.98);
    expect(debris.b).toBeGreaterThan(debris.r);
    expect(rain.r).toBeGreaterThan(rain.g);
  });
});

describe("reading a volume as it streams", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads a gzipped legacy volume's lowest scan and stops there", async () => {
    const frames: Uint8Array[] = [volumeHeader("ARCHIVE2.349", "")];
    for (let i = 0; i < 360; i += 1)
      frames.push(
        message1({ az: i + 0.5, angle: 0.5, elev: 1, ref: [106, 126] }),
      );
    for (let i = 0; i < 360; i += 1)
      frames.push(
        message1({
          az: i + 0.5,
          angle: 0.5,
          elev: 2,
          vel: [149, 109],
          ms: 3_660_000,
        }),
      );
    for (let i = 0; i < 2000; i += 1)
      frames.push(
        message1({ az: (i % 360) + 0.5, angle: 1.5, elev: 3, ref: [1] }),
      );
    const body = gzipSync(concat(...frames));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body)),
    );
    const scan = await readLowestScan({
      key: "x/KTLX19990503_000321.gz",
      site: "KTLX",
      time: 0,
      url: "u",
      gz: true,
    });
    expect(scan.site).toBe("KTLX");
    expect(scan.lat).toBeCloseTo(35.333, 2); // from the table: legacy volumes do not say
    expect(scan.sweeps.REF).toMatchObject({
      rows: 360,
      gates: 2,
      spacing: 1000,
    });
    expect(scan.sweeps.VEL).toMatchObject({
      rows: 360,
      gates: 2,
      spacing: 250,
      elev: 2,
    });
    expect(valueOf(scan.sweeps.VEL!, scan.sweeps.VEL!.data[0]!)).toBe(10);
    expect(scan.sweeps.RHO).toBeUndefined();
  });

  it("reads a modern volume record by record", async () => {
    const rec = record();
    const size = new Uint8Array(4);
    new DataView(size.buffer).setInt32(0, -rec.length);
    const body = concat(volumeHeader("AR2V0006.700", "KDMX"), size, rec);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body)),
    );
    const scan = await readLowestScan({
      key: "x/KDMX20240521_200000_V06",
      site: "KDMX",
      time: 0,
      url: "u",
      gz: false,
    });
    expect(scan.lat).toBeCloseTo(41.7312, 3); // from the volume itself
    expect(Object.keys(scan.sweeps).sort()).toEqual(["REF", "RHO", "VEL"]);
    expect(scan.sweeps.VEL!.elev).toBe(2);
    expect(scan.sweeps.VEL!.nyquist).toBeCloseTo(25.51, 2);
    // Row 0 covers 0-0.5 degrees, whose radial is at 0.25.
    const vel = scan.sweeps.VEL!;
    expect(valueOf(vel, vel.data[1]!)).toBe(10);
    expect(valueOf(vel, vel.data[2]!)).toBe(-10);
  });
});
