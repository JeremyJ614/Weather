/**
 * The 3D noise texture the funnel is carved out of.
 *
 * A raymarch samples noise 20-odd times per pixel per frame. Computing it
 * arithmetically in the shader — simplex, worley, stacked fbm — is hundreds of
 * ALU instructions in the inner loop, and it is the single most expensive
 * thing a volumetric funnel does. A texture lookup is one instruction, and the
 * hardware's trilinear filter does the interpolation for free.
 *
 * So the noise is baked once at startup into a 3D texture and never computed
 * again. 32^3 RGBA is 128 KB and takes a few milliseconds to build.
 *
 * The octaves are periodic — each one wraps at its own frequency, and every
 * frequency divides the texture size — so the result tiles seamlessly under
 * `REPEAT`. Without that the funnel shows a visible seam every time the
 * sampling coordinate crosses a texture boundary, which on a rotating column
 * is constantly.
 */

/** Octave frequency and its weight. All must divide SIZE for the tile to close. */
const OCTAVES: readonly (readonly [number, number])[] = [
  [4, 0.5],
  [8, 0.3],
  [16, 0.2],
];

export const NOISE_SIZE = 32;

/** Deterministic, so the same funnel looks the same on every device and run. */
function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    // xorshift32 — cheap, and good enough for noise lattice values.
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Three independent noise fields, one per colour channel.
 *
 * The shader uses them for different things — the funnel body, a second
 * higher-frequency tap for detail, and the debris bowl — and they have to be
 * uncorrelated or the three features pulse together and the whole column
 * breathes as one object.
 */
export function buildNoise3D(size = NOISE_SIZE): Uint8Array {
  const out = new Uint8Array(size * size * size * 4);

  for (let ch = 0; ch < 3; ch += 1) {
    // One lattice per octave, filled with random values.
    const lattices = OCTAVES.map(([freq], k) => {
      const rand = seeded(ch * 9781 + k * 137 + 7);
      const a = new Float32Array(freq * freq * freq);
      for (let i = 0; i < a.length; i += 1) a[i] = rand();
      return a;
    });

    for (let z = 0; z < size; z += 1) {
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          let v = 0;

          for (let k = 0; k < OCTAVES.length; k += 1) {
            const [freq, weight] = OCTAVES[k]!;
            const lat = lattices[k]!;
            const fx = (x * freq) / size;
            const fy = (y * freq) / size;
            const fz = (z * freq) / size;
            const x0 = Math.floor(fx);
            const y0 = Math.floor(fy);
            const z0 = Math.floor(fz);
            const sx = smooth(fx - x0);
            const sy = smooth(fy - y0);
            const sz = smooth(fz - z0);
            // Wrapping the upper corner is what makes the octave periodic.
            const x1 = (x0 + 1) % freq;
            const y1 = (y0 + 1) % freq;
            const z1 = (z0 + 1) % freq;
            const at = (a: number, b: number, c: number) =>
              lat[(c * freq + b) * freq + a]!;

            v +=
              lerp(
                lerp(
                  lerp(at(x0, y0, z0), at(x1, y0, z0), sx),
                  lerp(at(x0, y1, z0), at(x1, y1, z0), sx),
                  sy,
                ),
                lerp(
                  lerp(at(x0, y0, z1), at(x1, y0, z1), sx),
                  lerp(at(x0, y1, z1), at(x1, y1, z1), sx),
                  sy,
                ),
                sz,
              ) * weight;
          }

          out[((z * size + y) * size + x) * 4 + ch] = Math.round(
            Math.min(1, Math.max(0, v)) * 255,
          );
        }
      }
    }
  }

  // Alpha is unused but must be opaque: some drivers pre-multiply on upload.
  for (let i = 3; i < out.length; i += 4) out[i] = 255;
  return out;
}
