/**
 * A visible edge for a data color on the dark ground (owner's list #41: Star Gazing's darkest
 * bands didn't show at all). The fill keeps the owner's color exactly; this lighter twin of
 * the same hue outlines and caps it, so even a near-black band reads. Colors light enough
 * already come back as they are. Accepts #rgb, #rrggbb and rgb()/rgba().
 */
export function lit(color: string, minL = 0.62): string {
  const rgb = parse(color);
  if (!rgb) return color;
  const [h, s, l] = toHsl(rgb);
  if (l >= minL) return color;
  // Raise the lightness and keep some of the hue's saturation.
  return `hsl(${Math.round(h)}, ${Math.round(Math.min(100, s * 100 + 10))}%, ${Math.round(minL * 100)}%)`;
}

function parse(c: string): [number, number, number] | null {
  const x = c.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(x);
  if (m)
    return m[1].split("").map((d) => parseInt(d + d, 16)) as [
      number,
      number,
      number,
    ];
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(x);
  if (m) {
    const n = parseInt(m[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(x);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

function toHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === R
      ? ((G - B) / d + (G < B ? 6 : 0)) * 60
      : max === G
        ? ((B - R) / d + 2) * 60
        : ((R - G) / d + 4) * 60;
  return [h, s, l];
}
