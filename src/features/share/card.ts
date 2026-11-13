/**
 * The share-card kit (owner, 2026-11-13: share pictures with a wow factor that still read as
 * professional). One look for every page: the theme's ground with a glow and a faint grid,
 * weather.sswx.space top left, SSWX Weather Center over the page's name, lit frames, rings,
 * tiles and panels. Drawn on the phone and loaded only when someone shares, so it costs the
 * server nothing and no page carries it until it's used.
 */
type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

export type Tokens = {
  accent: string;
  text: string;
  muted: string;
  line: string;
  bg: string;
  sans: string;
  disp: string;
};

/** The theme's tokens, with the display face loaded; `accent` overrides the glow color. */
export async function tokens(accent?: string): Promise<Tokens> {
  const css = getComputedStyle(document.documentElement);
  const v = (n: string, d: string) => css.getPropertyValue(n).trim() || d;
  const sans = getComputedStyle(document.body).fontFamily;
  const disp = v("--font-display", sans);
  await Promise.all([
    document.fonts.load(`800 72px ${disp}`),
    document.fonts.load(`700 20px ${sans}`),
  ]).catch(() => {});
  return {
    accent: accent || v("--accent", "#d9b76f"),
    text: v("--text", "#f2f2f5"),
    muted: v("--muted", "#9a9aa6"),
    line: v("--line", "#2a2a36"),
    bg: v("--bg", "#07080f"),
    sans,
    disp,
  };
}

export const W = 1080;
const PAD = 56;
const MAX_H = 4600;

export type Tile = { k: string; v: string; sub?: string; color?: string };

export class Card {
  readonly g: Ctx;
  readonly t: Tokens;
  readonly pad = PAD;
  /** The box text and blocks fill: the page, or a panel's inside. */
  x = PAD;
  w = W - PAD * 2;
  y = 0;
  private c: HTMLCanvasElement;

  constructor(t: Tokens) {
    this.t = t;
    this.c = document.createElement("canvas");
    this.c.width = W;
    this.c.height = MAX_H;
    this.g = this.c.getContext("2d")! as Ctx;
    this.g.textBaseline = "alphabetic";
  }

  font(weight: number, size: number, disp = false) {
    this.g.font = `${weight} ${size}px ${disp ? this.t.disp : this.t.sans}`;
  }
  track(px: number) {
    this.g.letterSpacing = `${px}px`;
  }
  glow(blur: number, color = this.t.accent) {
    this.g.shadowColor = color;
    this.g.shadowBlur = blur;
  }
  reset() {
    this.g.shadowBlur = 0;
    this.g.globalAlpha = 1;
    this.g.textAlign = "left";
    this.track(0);
  }
  rr(x: number, y: number, w: number, h: number, r: number) {
    this.g.beginPath();
    this.g.roundRect(x, y, w, h, r);
  }
  gap(n: number) {
    this.y += n;
  }
  /** Room left before the card's height cap; blocks stop drawing when it runs out. */
  get room() {
    return MAX_H - 220 - this.y;
  }

  wrap(text: string, w: number) {
    const out: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const t = line ? `${line} ${word}` : word;
      if (this.g.measureText(t).width > w && line) {
        out.push(line);
        line = word;
      } else line = t;
    }
    if (line) out.push(line);
    return out;
  }

  /** A wrapped paragraph in the current box. */
  text(
    str: string,
    o: {
      size?: number;
      weight?: number;
      color?: string;
      disp?: boolean;
      lh?: number;
      max?: number;
      align?: CanvasTextAlign;
      alpha?: number;
      track?: number;
    } = {},
  ) {
    const size = o.size ?? 22;
    const lh = size * (o.lh ?? 1.5);
    this.font(o.weight ?? 400, size, o.disp);
    if (o.track) this.track(o.track);
    let lines = this.wrap(str, this.w);
    const max = o.max ?? 99;
    if (lines.length > max) {
      lines = lines.slice(0, max);
      lines[max - 1] = `${lines[max - 1].replace(/[\s,.;:]+$/, "")}…`;
    }
    const g = this.g;
    g.fillStyle = o.color ?? this.t.text;
    g.globalAlpha = o.alpha ?? 1;
    g.textAlign = o.align ?? "left";
    const x =
      o.align === "center"
        ? this.x + this.w / 2
        : o.align === "right"
          ? this.x + this.w
          : this.x;
    lines.forEach((l, i) => g.fillText(l, x, this.y + size * 0.95 + i * lh));
    this.y += size * 0.95 + (lines.length - 1) * lh + size * 0.45;
    this.reset();
    return lines.length;
  }

  /** Small tracked capitals, the kit's section label. */
  label(str: string, color = this.t.accent, align: CanvasTextAlign = "left") {
    this.text(str.toUpperCase(), {
      size: 15,
      weight: 800,
      color,
      track: 5,
      align,
    });
    this.gap(10);
  }

  /** The link top left, the time top right, then SSWX Weather Center over the page's name. */
  header(title: string, sub?: string) {
    const g = this.g;
    this.y = 58;
    this.font(700, 17);
    this.track(3);
    g.fillStyle = this.t.accent;
    g.fillText("WEATHER.SSWX.SPACE", PAD, this.y);
    g.textAlign = "right";
    g.fillStyle = this.t.muted;
    g.fillText(
      new Date()
        .toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
        .toUpperCase(),
      W - PAD,
      this.y,
    );
    this.reset();
    this.y += 74;
    g.textAlign = "center";
    this.font(800, 19);
    this.track(9);
    g.fillStyle = this.t.accent;
    g.fillText("SSWX WEATHER CENTER", W / 2, this.y);
    this.reset();
    this.y += 86;
    let size = 76;
    this.font(800, size, true);
    while (size > 44 && g.measureText(title).width > this.w) {
      size -= 4;
      this.font(800, size, true);
    }
    g.textAlign = "center";
    this.glow(30);
    g.fillStyle = this.t.text;
    g.fillText(title, W / 2, this.y);
    this.reset();
    if (sub) {
      this.y += 30;
      this.text(sub, {
        size: 25,
        weight: 500,
        color: this.t.muted,
        align: "center",
        max: 2,
        lh: 1.3,
      });
    }
    this.gap(34);
  }

  /** A segmented ring gauge (the score dials' look), lit to `frac`, centred at (cx, cy). */
  ring(
    cx: number,
    cy: number,
    r: number,
    frac: number,
    color: string,
    big: string,
    small: string,
  ) {
    const g = this.g;
    const segs = 60;
    const lit = Math.round(Math.max(0, Math.min(1, frac)) * segs);
    g.lineCap = "round";
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2 - Math.PI / 2;
      const long = i % 5 === 0;
      const r0 = r - (long ? 26 : 18);
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.lineWidth = long ? 6 : 5;
      if (i < lit) {
        g.strokeStyle = color;
        this.glow(14, color);
      } else {
        g.strokeStyle = this.t.line;
        g.shadowBlur = 0;
      }
      g.stroke();
    }
    this.reset();
    // Inner disc and the reading.
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r - 30);
    grad.addColorStop(0, "rgba(255,255,255,0.06)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cy, r - 30, 0, Math.PI * 2);
    g.fill();
    g.textAlign = "center";
    this.font(800, Math.round(r * 0.62), true);
    this.glow(24, color);
    g.fillStyle = this.t.text;
    g.fillText(big, cx, cy + r * 0.2);
    this.reset();
    g.textAlign = "center";
    this.font(700, 16);
    this.track(3);
    g.fillStyle = this.t.muted;
    g.fillText(small.toUpperCase(), cx, cy + r * 0.2 + 34);
    this.reset();
  }

  /**
   * A ring on the left with a kicker, a big colored name and a paragraph beside it: the hero
   * every card opens with.
   */
  hero(o: {
    frac: number;
    color: string;
    big: string;
    small: string;
    kicker: string;
    name: string;
    body?: string;
  }) {
    const r = 150;
    const top = this.y;
    this.ring(this.x + r + 6, top + r + 6, r, o.frac, o.color, o.big, o.small);
    const x0 = this.x;
    const w0 = this.w;
    this.x = x0 + r * 2 + 50;
    this.w = w0 - (r * 2 + 50);
    this.y = top + 22;
    this.label(o.kicker, this.t.muted);
    this.glow(22, o.color);
    this.text(o.name, {
      size: 52,
      weight: 800,
      disp: true,
      color: o.color,
      lh: 1.1,
      max: 2,
    });
    this.gap(8);
    if (o.body)
      this.text(o.body, { size: 22, color: this.t.text, alpha: 0.86, max: 5 });
    this.x = x0;
    this.w = w0;
    this.y = Math.max(this.y, top + r * 2 + 12) + 30;
  }

  /** Stat tiles in a grid; the value shrinks to fit its tile. */
  tiles(items: Tile[], cols = 3) {
    const g = this.g;
    const gapX = 16;
    const tw = (this.w - gapX * (cols - 1)) / cols;
    const th = items.some((t) => t.sub) ? 142 : 116;
    items.forEach((t, i) => {
      const x = this.x + (i % cols) * (tw + gapX);
      const y = this.y + Math.floor(i / cols) * (th + gapX);
      g.fillStyle = "rgba(255,255,255,0.035)";
      this.rr(x, y, tw, th, 18);
      g.fill();
      g.strokeStyle = this.t.line;
      g.lineWidth = 1.5;
      this.rr(x + 0.75, y + 0.75, tw - 1.5, th - 1.5, 18);
      g.stroke();
      if (t.color) {
        g.fillStyle = t.color;
        this.glow(12, t.color);
        this.rr(x + 20, y + 18, 30, 4, 2);
        g.fill();
        this.reset();
      }
      this.font(700, 14);
      this.track(3);
      g.fillStyle = this.t.muted;
      g.fillText(t.k.toUpperCase(), x + 20, y + 46, tw - 40);
      this.reset();
      let size = 38;
      this.font(800, size, true);
      while (size > 20 && g.measureText(t.v).width > tw - 40) {
        size -= 2;
        this.font(800, size, true);
      }
      g.fillStyle = t.color ?? this.t.text;
      if (t.color) this.glow(16, t.color);
      g.fillText(t.v, x + 20, y + 90);
      this.reset();
      if (t.sub) {
        this.font(500, 17);
        g.fillStyle = this.t.muted;
        g.fillText(t.sub, x + 20, y + 120, tw - 40);
      }
    });
    this.y += Math.ceil(items.length / cols) * (th + gapX) - gapX + 30;
  }

  /** A glowing bar, `frac` full, with optional tick marks (fractions). */
  meter(frac: number, color: string, ticks: number[] = [], h = 14) {
    const g = this.g;
    g.fillStyle = "rgba(255,255,255,0.06)";
    this.rr(this.x, this.y, this.w, h, h / 2);
    g.fill();
    const f = Math.max(0, Math.min(1, frac));
    if (f > 0) {
      const grad = g.createLinearGradient(this.x, 0, this.x + this.w * f, 0);
      grad.addColorStop(0, "rgba(255,255,255,0.15)");
      grad.addColorStop(0.35, color);
      grad.addColorStop(1, color);
      g.fillStyle = grad;
      this.glow(16, color);
      this.rr(this.x, this.y, Math.max(h, this.w * f), h, h / 2);
      g.fill();
      this.reset();
    }
    g.fillStyle = this.t.bg;
    for (const t of ticks) g.fillRect(this.x + this.w * t - 1.5, this.y, 3, h);
    this.y += h;
  }

  /** The map, or any picture, in a lit frame with corner marks. */
  frame(
    img: CanvasImageSource & { width: number; height: number },
    maxH = 1100,
  ) {
    const g = this.g;
    const k = Math.min(this.w / img.width, maxH / img.height);
    const mw = Math.round(img.width * k);
    const mh = Math.round(img.height * k);
    const mx = this.x + (this.w - mw) / 2;
    const y = this.y + 12;
    g.save();
    this.glow(46);
    g.fillStyle = "#000";
    this.rr(mx, y, mw, mh, 22);
    g.fill();
    g.restore();
    g.save();
    this.rr(mx, y, mw, mh, 22);
    g.clip();
    g.drawImage(img, mx, y, mw, mh);
    g.restore();
    g.strokeStyle = this.t.accent;
    g.globalAlpha = 0.55;
    g.lineWidth = 1.5;
    this.rr(mx + 0.75, y + 0.75, mw - 1.5, mh - 1.5, 22);
    g.stroke();
    g.globalAlpha = 1;
    g.lineWidth = 3;
    this.glow(12);
    const o = 12;
    const L = 34;
    for (const [cx, cy, dx, dy] of [
      [mx - o, y - o, 1, 1],
      [mx + mw + o, y - o, -1, 1],
      [mx - o, y + mh + o, 1, -1],
      [mx + mw + o, y + mh + o, -1, -1],
    ]) {
      g.beginPath();
      g.moveTo(cx, cy + dy * L);
      g.lineTo(cx, cy);
      g.lineTo(cx + dx * L, cy);
      g.stroke();
    }
    this.reset();
    this.y = y + mh + 42;
  }

  /** Color keys, wrapping, centred line by line. */
  legend(items: [string, string][]) {
    const g = this.g;
    this.font(600, 19);
    const it = items.map(([l, col]) => ({
      l,
      col,
      w: 26 + g.measureText(l).width,
    }));
    const rows: (typeof it)[] = [[]];
    let rw = 0;
    for (const x of it) {
      if (rw + x.w > this.w && rows[rows.length - 1].length) {
        rows.push([]);
        rw = 0;
      }
      rows[rows.length - 1].push(x);
      rw += x.w + 26;
    }
    for (const row of rows.filter((r) => r.length)) {
      let x = this.x + (this.w - row.reduce((a, b) => a + b.w + 26, -26)) / 2;
      for (const b of row) {
        g.fillStyle = b.col;
        this.rr(x, this.y + 3, 16, 16, 4);
        g.fill();
        g.fillStyle = this.t.muted;
        g.fillText(b.l, x + 26, this.y + 18);
        x += b.w + 26;
      }
      this.y += 34;
    }
    this.y += 14;
  }

  /** Pills with a label and a bold value, wrapping. */
  chips(items: [string, string][], color = this.t.accent) {
    const g = this.g;
    let x = this.x;
    const h = 40;
    for (const [k, v] of items) {
      this.font(500, 18);
      const kw = g.measureText(`${k} `).width;
      this.font(800, 18);
      const vw = g.measureText(v).width;
      const w = kw + vw + 32;
      if (x + w > this.x + this.w && x > this.x) {
        x = this.x;
        this.y += h + 10;
      }
      g.strokeStyle = this.t.line;
      g.lineWidth = 1.5;
      g.fillStyle = "rgba(255,255,255,0.03)";
      this.rr(x, this.y, w, h, h / 2);
      g.fill();
      g.stroke();
      this.font(500, 18);
      g.fillStyle = this.t.muted;
      g.fillText(`${k} `, x + 16, this.y + 26);
      this.font(800, 18);
      g.fillStyle = color;
      g.fillText(v, x + 16 + kw, this.y + 26);
      x += w + 10;
    }
    this.y += h + 22;
  }

  /** Bulleted lines with a lit marker. */
  bullets(items: string[], color = this.t.accent, max = 8) {
    const x0 = this.x;
    const w0 = this.w;
    for (const it of items.slice(0, max)) {
      if (this.room < 80) break;
      this.g.fillStyle = color;
      this.glow(10, color);
      this.rr(x0, this.y + 12, 8, 8, 2);
      this.g.fill();
      this.reset();
      this.x = x0 + 26;
      this.w = w0 - 26;
      this.text(it, { size: 21, alpha: 0.9, lh: 1.45, max: 4 });
      this.gap(8);
    }
    this.x = x0;
    this.w = w0;
  }

  divider() {
    this.g.fillStyle = this.t.line;
    this.g.fillRect(this.x, this.y, this.w, 1.5);
    this.y += 30;
  }

  /** A framed panel: a label (and a lit tag) on top, `body` drawn inside it. */
  panel(label: string, tag: string | null, body: () => void) {
    const g = this.g;
    const top = this.y;
    const x0 = this.x;
    const w0 = this.w;
    this.x = x0 + 34;
    this.w = w0 - 68;
    this.y = top + 34;
    let under = 0;
    if (tag) {
      this.font(800, 15);
      this.track(4);
      const tw = g.measureText(tag).width + 40;
      const tx = this.x + this.w - tw;
      g.save();
      this.glow(18);
      g.strokeStyle = this.t.accent;
      g.lineWidth = 1.5;
      this.rr(tx, this.y - 6, tw, 36, 18);
      g.stroke();
      g.restore();
      g.fillStyle = this.t.accent;
      g.fillText(tag, tx + 22, this.y + 18);
      this.reset();
      under = this.y + 44;
    }
    this.label(label);
    this.y = Math.max(this.y + 6, under);
    body();
    this.y += 14;
    const h = this.y - top;
    this.x = x0;
    this.w = w0;
    g.save();
    g.globalCompositeOperation = "destination-over";
    g.fillStyle = "rgba(255,255,255,0.028)";
    this.rr(x0, top, w0, h, 24);
    g.fill();
    g.restore();
    g.strokeStyle = this.t.line;
    g.lineWidth = 1.5;
    this.rr(x0 + 0.75, top + 0.75, w0 - 1.5, h - 1.5, 24);
    g.stroke();
    this.y += 30;
  }

  /** The closing line, then the picture: cropped, on the glowing, gridded ground. */
  async finish(foot: string): Promise<Blob> {
    this.gap(14);
    this.x = PAD;
    this.w = W - PAD * 2;
    this.text(foot, {
      size: 17,
      weight: 500,
      color: this.t.muted,
      align: "center",
      max: 3,
    });
    const H = Math.min(MAX_H, Math.ceil(this.y + 36));
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const q = out.getContext("2d")!;
    q.fillStyle = this.t.bg;
    q.fillRect(0, 0, W, H);
    const glow = (x: number, y: number, r: number, a: number) => {
      const rg = q.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, this.t.accent);
      rg.addColorStop(1, "transparent");
      q.globalAlpha = a;
      q.fillStyle = rg;
      q.fillRect(x - r, y - r, r * 2, r * 2);
    };
    glow(W / 2, 0, 780, 0.22);
    glow(W, H, 700, 0.1);
    q.globalAlpha = 0.035;
    q.fillStyle = this.t.text;
    for (let gx = 0; gx < W; gx += 40) q.fillRect(gx, 0, 1, H);
    for (let gy = 0; gy < H; gy += 40) q.fillRect(0, gy, W, 1);
    q.globalAlpha = 1;
    q.drawImage(this.c, 0, 0, W, H, 0, 0, W, H);
    return new Promise<Blob>((ok, no) =>
      out.toBlob((b) => (b ? ok(b) : no(new Error("empty"))), "image/png"),
    );
  }
}

/** A card on the theme (or `accent`) with the header drawn. */
export async function card(title: string, sub: string, accent?: string) {
  const c = new Card(await tokens(accent));
  c.header(title, sub);
  return c;
}

/** A PNG blob (a map export) as something the frame can draw. */
export const bitmap = (b: Blob) => createImageBitmap(b);
