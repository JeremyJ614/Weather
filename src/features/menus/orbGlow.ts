/**
 * Each orb's glow color ("r, g, b"), steady per section or page: the pen's teal, silver and
 * mauve, widened to a spectrum so neighbors differ. Not a theme: the colors stay the same
 * whatever theme is on; everything around the orbs follows the theme.
 */
const GLOWS = [
  "52, 160, 170", // teal
  "188, 108, 148", // mauve
  "180, 195, 210", // silver
  "214, 160, 70", // amber
  "92, 132, 236", // azure
  "120, 190, 110", // fern
  "226, 96, 110", // rose
  "150, 116, 232", // violet
  "70, 200, 230", // sky
  "232, 140, 90", // ember
];

export function glow(key: string) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GLOWS[h % GLOWS.length];
}

/** Glows for a list, spread so two neighbors never share one. */
export function glows(keys: string[]) {
  const out: string[] = [];
  keys.forEach((k, i) => {
    let g = glow(k);
    let n = 0;
    while ((g === out[i - 1] || g === out[i - 2]) && n < GLOWS.length) {
      g = GLOWS[(GLOWS.indexOf(g) + 3) % GLOWS.length];
      n++;
    }
    out.push(g);
  });
  return out;
}
