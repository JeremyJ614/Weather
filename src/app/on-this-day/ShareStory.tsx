"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { toPng, type Swatch } from "@/features/maps/UsMap";

type Story = {
  title: string;
  headline: string;
  paragraphs: string[];
  /** YYYY and MM-DD of the event. */
  year: number;
  md: string;
  places: string[];
  stats: { k: string; v: string }[];
  mapTitle: string;
  legend: Swatch[];
};

/**
 * Shares the whole story as one post, laid out as the front page of "The Storm Ledger"
 * (owner's pick, 2026-11-13): masthead, dateline, headline, the map as Fig. 1, the whole story
 * with a drop cap and a "By the numbers" sidebar, and the link. Drawn on the phone, so it costs
 * the server nothing; the story text goes along for apps that post it with the picture.
 */
export function ShareStory(p: Story & { file: string }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const go = async () => {
    setBusy(true);
    setNote("");
    try {
      const svg = document.querySelector<SVGSVGElement>("[data-otd-map] svg");
      const map = svg ? await toPng(svg, p.mapTitle, "", p.legend, true) : null;
      const card = await draw(p, map);
      const url = `${location.origin}/on-this-day`;
      const text = `${p.title}\n${p.headline}\n\n${p.paragraphs.join("\n\n")}\n\nRead it on SSWX Weather Center: ${url}`;
      const f = new File([card], `${p.file}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title: p.title, text });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(card);
        a.download = f.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        await navigator.clipboard?.writeText(text).catch(() => {});
        setNote("Image saved, and the story text is copied to paste with it.");
      }
    } catch {
      /* the share sheet was closed */
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid justify-items-start gap-1">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm font-bold text-text"
      >
        <Share2 className="size-4 text-accent" aria-hidden />
        {busy ? "Making the post…" : "Share the story"}
      </button>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}

const SERIF = '"SSWX Playfair", Georgia, serif';
const BODY = 'Georgia, "Noto Serif", "Times New Roman", serif';
const INK = "#ece7da";
const DIM = "#a49b86";
const RULE = "#3a3528";
const GOLD = "#d9b76f";

/** The headline face, self-hosted (Playfair Display, OFL), loaded once on the first share. */
let faces: Promise<unknown> | null = null;
const loadFaces = () =>
  (faces ??= Promise.all(
    [
      ["/fonts/playfair-display.woff2", "normal"],
      ["/fonts/playfair-display-italic.woff2", "italic"],
    ].map(([src, style]) =>
      new FontFace("SSWX Playfair", `url(${src})`, { weight: "400 900", style })
        .load()
        .then((f) => document.fonts.add(f)),
    ),
  ).catch(() => {}));

/** Lines that fit: `widths[i]` for line i (the last width repeats). */
function wrap(g: CanvasRenderingContext2D, text: string, widths: number[]) {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const t = line ? `${line} ${word}` : word;
    const w = widths[Math.min(out.length, widths.length - 1)];
    if (g.measureText(t).width > w && line) {
      out.push(line);
      line = word;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

async function draw(p: Story, map: Blob | null) {
  await loadFaces();
  const W = 1080;
  const pad = 64;
  const cw = W - pad * 2;
  const sans = getComputedStyle(document.body).fontFamily;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = 3400;
  const g = c.getContext("2d")!;
  const space = (v: string) => {
    (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
      v;
  };
  const rule = (y: number, color = RULE, w = 1) => {
    g.fillStyle = color;
    g.fillRect(pad, y, cw, w);
  };
  const center = (t: string, y: number) => g.fillText(t, W / 2, y);

  // Masthead
  let y = 56 + 18;
  g.textAlign = "center";
  g.fillStyle = GOLD;
  g.font = `700 15px ${sans}`;
  space("6px");
  center("SSWX WEATHER CENTER · ON THIS DAY", y);
  space("0px");
  y += 86;
  g.fillStyle = INK;
  g.font = `900 76px ${SERIF}`;
  center("The Storm Ledger", y);
  y += 26;
  rule(y, "#6d6450");
  rule(y + 5, "#6d6450");

  // Dateline
  y += 38;
  const [m, d] = p.md.split("-").map(Number);
  const date = new Date(Date.UTC(p.year, m - 1, d))
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();
  g.font = `600 16px ${sans}`;
  space("2px");
  g.fillStyle = DIM;
  g.textAlign = "left";
  g.fillText(date, pad, y);
  let where = p.places.join(" · ").toUpperCase();
  const room = cw - g.measureText(date).width - 40;
  while (where && g.measureText(where).width > room)
    where = where.split(" · ").slice(0, -1).join(" · ");
  g.textAlign = "right";
  g.fillText(where, W - pad, y);
  space("0px");
  y += 16;
  rule(y);

  // Headline and deck
  g.textAlign = "center";
  g.fillStyle = INK;
  g.font = `900 78px ${SERIF}`;
  y += 92;
  for (const l of wrap(g, p.title, [cw])) {
    center(l, y);
    y += 84;
  }
  g.fillStyle = "#cfc6b0";
  g.font = `italic 700 30px ${SERIF}`;
  y += 4;
  for (const l of wrap(g, p.headline, [cw - 60])) {
    center(l, y);
    y += 42;
  }

  // Fig. 1
  if (map) {
    const img = await createImageBitmap(map);
    const iw = cw - 20;
    const ih = Math.round((img.height / img.width) * iw);
    y += 12;
    g.fillStyle = "#0c0c11";
    g.fillRect(pad, y, cw, ih + 64);
    g.strokeStyle = "#4a4434";
    g.lineWidth = 1;
    g.strokeRect(pad + 0.5, y + 0.5, cw - 1, ih + 63);
    g.filter = "sepia(0.25) saturate(1.1)";
    g.drawImage(img, pad + 10, y + 10, iw, ih);
    g.filter = "none";
    g.font = `500 16px ${sans}`;
    g.fillStyle = DIM;
    g.textAlign = "left";
    g.fillText(`Fig. 1 — ${p.mapTitle}`, pad + 10, y + ih + 42, cw - 220);
    g.textAlign = "right";
    g.fillText(
      p.legend.map((l) => l.label).join(" · "),
      W - pad - 10,
      y + ih + 42,
    );
    y += ih + 64;
  }

  // Story with a drop cap, and the sidebar
  y += 46;
  const top = y;
  const colW = cw - 270 - 36;
  const side = pad + colW + 36;
  g.textAlign = "left";
  const lh = 39;
  const stop = 2900;
  const paras = p.paragraphs.filter(Boolean);
  if (paras.length) {
    const first = paras[0];
    g.font = `900 104px ${SERIF}`;
    const capW = g.measureText(first[0]).width + 14;
    g.fillStyle = GOLD;
    g.fillText(first[0], pad, y + 70);
    g.font = `400 25px ${BODY}`;
    g.fillStyle = "#ddd6c6";
    let cut = false;
    paras.forEach((para, i) => {
      if (cut) return;
      const text = i === 0 ? para.slice(1) : para;
      const widths =
        i === 0 ? [colW - capW, colW - capW, colW - capW, colW] : [colW];
      wrap(g, text, widths).forEach((l, j) => {
        if (cut) return;
        if (y > stop) {
          g.fillText("…", pad, y);
          cut = true;
          return;
        }
        const x = i === 0 && j < 3 ? pad + capW : pad;
        g.fillText(l, x, y + 26);
        y += lh;
      });
      y += 18;
    });
  }
  // Sidebar
  let sy = top;
  const sx = side + 28;
  const sw = 270 - 28;
  g.fillStyle = GOLD;
  g.font = `800 15px ${sans}`;
  space("5px");
  g.fillText("BY THE NUMBERS", sx, sy + 14);
  space("0px");
  sy += 32;
  for (const s of p.stats.slice(0, 5)) {
    g.fillStyle = RULE;
    g.fillRect(sx, sy, sw, 1);
    let size = 54;
    g.font = `900 ${size}px ${SERIF}`;
    while (size > 28 && g.measureText(s.v).width > sw) {
      size -= 4;
      g.font = `900 ${size}px ${SERIF}`;
    }
    g.fillStyle = INK;
    g.fillText(s.v, sx, sy + 14 + size * 0.85);
    sy += 30 + size;
    g.font = `600 15px ${sans}`;
    g.fillStyle = DIM;
    for (const l of wrap(g, s.k, [sw])) {
      g.fillText(l, sx, sy + 6);
      sy += 20;
    }
    sy += 16;
  }
  g.fillStyle = RULE;
  g.fillRect(side, top, 1, Math.max(y, sy) - top - 10);

  // Footer
  y = Math.max(y, sy) + 20;
  rule(y, "#6d6450");
  rule(y + 5, "#6d6450");
  y += 46;
  g.font = `700 18px ${sans}`;
  space("4px");
  g.fillStyle = GOLD;
  g.textAlign = "left";
  g.fillText("WEATHER.SSWX.SPACE", pad, y);
  g.fillStyle = DIM;
  g.textAlign = "right";
  g.fillText("READ IT ON SSWX", W - pad, y);
  space("0px");
  const H = y + 52;

  // Crop to the content, on the ledger's paper with its faint print lines.
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const o = out.getContext("2d")!;
  o.fillStyle = "#121218";
  o.fillRect(0, 0, W, H);
  o.fillStyle = "rgba(255,255,255,0.012)";
  for (let ly = 0; ly < H; ly += 4) o.fillRect(0, ly, W, 2);
  o.drawImage(c, 0, 0, W, H, 0, 0, W, H);
  return new Promise<Blob>((ok, no) =>
    out.toBlob((b) => (b ? ok(b) : no(new Error("empty"))), "image/png"),
  );
}
