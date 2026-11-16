import type { AnyMap } from "./WeatherMap";

/**
 * The live map as a titled PNG, in the static maps' style (owner, 2026-11-13: every map can
 * be downloaded or shared). The canvas is read inside a render pass, so no
 * preserveDrawingBuffer is needed.
 */
/** The live map canvas, read inside a render pass. */
export function grab(map: AnyMap) {
  return new Promise<HTMLCanvasElement>((ok) => {
    (map as { once: (e: string, f: () => void) => void }).once("render", () => {
      const src = map.getCanvas();
      const c = document.createElement("canvas");
      c.width = src.width;
      c.height = src.height;
      c.getContext("2d")!.drawImage(src, 0, 0);
      ok(c);
    });
    map.triggerRepaint();
  });
}

export async function mapPng(map: AnyMap, title: string): Promise<Blob> {
  const shot = await grab(map);
  const css = getComputedStyle(document.documentElement);
  const font = getComputedStyle(document.body).fontFamily;
  const k = shot.width / Math.max(1, map.getCanvas().clientWidth);
  const band = 80 * k;
  const foot = 30 * k;
  const c = document.createElement("canvas");
  c.width = shot.width;
  c.height = shot.height + band + foot;
  const g = c.getContext("2d")!;
  g.fillStyle = css.getPropertyValue("--bg").trim() || "#0b0c14";
  g.fillRect(0, 0, c.width, c.height);
  g.scale(k, k);
  g.fillStyle = css.getPropertyValue("--accent").trim() || "#d9b76f";
  g.font = `700 12px ${font}`;
  g.fillText("SSWX WEATHER CENTER", 18, 28);
  g.fillStyle = "#fff";
  g.font = `800 22px ${font}`;
  g.fillText(title, 18, 56, c.width / k - 36);
  g.fillStyle = css.getPropertyValue("--muted").trim() || "#999";
  g.font = `500 12px ${font}`;
  g.fillText(new Date().toLocaleString(), 18, 72);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(shot, 0, band);
  g.scale(k, k);
  g.fillStyle = css.getPropertyValue("--muted").trim() || "#999";
  g.font = `600 11px ${font}`;
  g.fillText("weather.sswx.space", 18, (c.height - 10 * k) / k);
  return new Promise<Blob>((ok, no) =>
    c.toBlob((b) => (b ? ok(b) : no(new Error("empty"))), "image/png"),
  );
}

/** What an engine map's picture says about it (Engines page). */
export type Brand = {
  name: string;
  sub: string;
  /** The lead line, then a short paragraph on how it works. */
  how: [string, string];
  legend: [string, string][];
};

const wrap = (g: CanvasRenderingContext2D, text: string, w: number) => {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const t = line ? `${line} ${word}` : word;
    if (g.measureText(t).width > w && line) {
      out.push(line);
      line = word;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
};

/**
 * An engine map as a branded card (owner, 2026-11-13): the link top left, SSWX Weather
 * Center over the engine's name, the map in a lit frame with its legend, then how the engine
 * works under an Experimental tag. Theme tokens only, so every theme gets its own look.
 */
export async function enginePng(
  shot: HTMLCanvasElement,
  b: Brand,
): Promise<Blob> {
  const css = getComputedStyle(document.documentElement);
  const v = (n: string, d: string) => css.getPropertyValue(n).trim() || d;
  const sans = getComputedStyle(document.body).fontFamily;
  const disp = v("--font-display", sans);
  await document.fonts.load(`800 72px ${disp}`).catch(() => {});
  const accent = v("--accent", "#d9b76f");
  const text = v("--text", "#f2f2f5");
  const muted = v("--muted", "#9a9aa6");
  const line = v("--line", "#2a2a36");
  const W = 1080;
  const pad = 56;
  const cw = W - pad * 2;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = 3200;
  const g = c.getContext("2d")!;
  const space = (px: number) => {
    (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
      `${px}px`;
  };
  const glow = (blur: number) => {
    g.shadowColor = accent;
    g.shadowBlur = blur;
  };
  const round = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
  };

  // Top row: the link, and when the picture was made.
  let y = 58;
  g.font = `700 17px ${sans}`;
  space(3);
  g.fillStyle = accent;
  g.fillText("WEATHER.SSWX.SPACE", pad, y);
  g.textAlign = "right";
  g.fillStyle = muted;
  g.fillText(
    new Date()
      .toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
      .toUpperCase(),
    W - pad,
    y,
  );

  // Title block.
  g.textAlign = "center";
  y += 74;
  g.font = `800 19px ${sans}`;
  space(9);
  g.fillStyle = accent;
  g.fillText("SSWX WEATHER CENTER", W / 2, y);
  space(0);
  y += 84;
  g.font = `800 78px ${disp}`;
  glow(28);
  g.fillStyle = text;
  g.fillText(b.name, W / 2, y, cw);
  g.shadowBlur = 0;
  y += 46;
  g.font = `500 25px ${sans}`;
  g.fillStyle = muted;
  g.fillText(b.sub, W / 2, y, cw);

  // The map in a lit frame, with corner marks.
  y += 46;
  const k = Math.min(cw / shot.width, 1150 / shot.height);
  const mw = Math.round(shot.width * k);
  const mh = Math.round(shot.height * k);
  const mx = (W - mw) / 2;
  g.save();
  glow(46);
  g.fillStyle = "#000";
  round(mx, y, mw, mh, 22);
  g.fill();
  g.restore();
  g.save();
  round(mx, y, mw, mh, 22);
  g.clip();
  g.drawImage(shot, mx, y, mw, mh);
  g.restore();
  g.strokeStyle = accent;
  g.globalAlpha = 0.55;
  g.lineWidth = 1.5;
  round(mx + 0.75, y + 0.75, mw - 1.5, mh - 1.5, 22);
  g.stroke();
  g.globalAlpha = 1;
  g.lineWidth = 3;
  glow(12);
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
  g.shadowBlur = 0;
  y += mh + 52;

  // Legend, wrapping, centred line by line.
  g.font = `600 19px ${sans}`;
  const items = b.legend.map(([l, col]) => ({
    l,
    col,
    w: 26 + g.measureText(l).width,
  }));
  const rows: (typeof items)[] = [[]];
  let rw = 0;
  for (const it of items) {
    if (rw + it.w > cw && rows[rows.length - 1].length) {
      rows.push([]);
      rw = 0;
    }
    rows[rows.length - 1].push(it);
    rw += it.w + 26;
  }
  g.textAlign = "left";
  for (const row of rows.filter((r) => r.length)) {
    let x = (W - row.reduce((a, it) => a + it.w + 26, -26)) / 2;
    for (const it of row) {
      g.fillStyle = it.col;
      round(x, y - 15, 16, 16, 4);
      g.fill();
      g.fillStyle = muted;
      g.fillText(it.l, x + 26, y);
      x += it.w + 26;
    }
    y += 34;
  }

  // How it works, under the Experimental tag.
  y += 18;
  const top = y;
  const ix = pad + 34;
  const iw = cw - 68;
  y += 52;
  g.font = `800 16px ${sans}`;
  space(5);
  g.fillStyle = accent;
  g.fillText("HOW IT WORKS", ix, y);
  g.font = `800 15px ${sans}`;
  space(4);
  const tag = "EXPERIMENTAL";
  const tw = g.measureText(tag).width + 40;
  const tx = pad + cw - 34 - tw;
  g.save();
  glow(18);
  g.strokeStyle = accent;
  g.lineWidth = 1.5;
  round(tx, y - 25, tw, 36, 18);
  g.stroke();
  g.restore();
  g.fillStyle = accent;
  g.fillText(tag, tx + 22, y - 1);
  space(0);
  y += 46;
  g.fillStyle = text;
  g.font = `700 26px ${sans}`;
  for (const l of wrap(g, b.how[0], iw)) {
    g.fillText(l, ix, y);
    y += 36;
  }
  y += 6;
  g.font = `400 22px ${sans}`;
  g.fillStyle = text;
  g.globalAlpha = 0.78;
  const body = wrap(g, b.how[1], iw);
  body.slice(0, 6).forEach((l, i) => {
    g.fillText(i === 5 && body.length > 6 ? `${l} …` : l, ix, y);
    y += 33;
  });
  g.globalAlpha = 1;
  y += 24;
  g.fillStyle = "rgba(255,255,255,0.025)";
  g.strokeStyle = line;
  g.lineWidth = 1.5;
  g.globalCompositeOperation = "destination-over";
  round(pad, top, cw, y - top, 24);
  g.fill();
  g.globalCompositeOperation = "source-over";
  round(pad + 0.75, top + 0.75, cw - 1.5, y - top - 1.5, 24);
  g.stroke();

  // Footer.
  y += 52;
  g.textAlign = "center";
  g.font = `500 17px ${sans}`;
  g.fillStyle = muted;
  g.fillText(
    "An experimental guide, never a warning. Act on National Weather Service warnings.",
    W / 2,
    y,
    cw,
  );
  const H = y + 44;

  // Background: the theme's ground, a glow from the top and a faint radar grid.
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const q = out.getContext("2d")!;
  q.fillStyle = v("--bg", "#07080f");
  q.fillRect(0, 0, W, H);
  const rg = q.createRadialGradient(W / 2, 0, 0, W / 2, 0, 760);
  rg.addColorStop(0, accent);
  rg.addColorStop(1, "transparent");
  q.globalAlpha = 0.2;
  q.fillStyle = rg;
  q.fillRect(0, 0, W, 760);
  q.globalAlpha = 0.035;
  q.fillStyle = text;
  for (let gx = 0; gx < W; gx += 40) q.fillRect(gx, 0, 1, H);
  for (let gy = 0; gy < H; gy += 40) q.fillRect(0, gy, W, 1);
  q.globalAlpha = 1;
  q.drawImage(c, 0, 0, W, H, 0, 0, W, H);
  return new Promise<Blob>((ok, no) =>
    out.toBlob((x) => (x ? ok(x) : no(new Error("empty"))), "image/png"),
  );
}

/** Share the image where the phone can, else download it. */
export async function saveOrShare(
  blob: Blob,
  name: string,
  title: string,
  share: boolean,
) {
  const f = new File([blob], `${name}.png`, { type: "image/png" });
  if (share && navigator.canShare?.({ files: [f] })) {
    await navigator.share({
      files: [f],
      title,
      url: location.href.split("#")[0],
    });
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = f.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
