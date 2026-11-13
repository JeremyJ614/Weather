"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { toPng } from "@/features/maps/UsMap";
import type { Swatch } from "@/features/maps/UsMap";

/**
 * Shares the whole story as one tall image, ready to post (owner, 2026-11-13): the date,
 * title and headline, the map, then the story itself, with the link, plus the text for
 * apps that post it alongside. Drawn on the phone, so it costs the server nothing.
 */
export function ShareStory(p: {
  eyebrow: string;
  title: string;
  headline: string;
  paragraphs: string[];
  mapTitle: string;
  legend: Swatch[];
  file: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const go = async () => {
    setBusy(true);
    setNote("");
    try {
      const svg = document.querySelector<SVGSVGElement>("[data-otd-map] svg");
      const map = svg ? await toPng(svg, p.mapTitle, "", p.legend) : null;
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

/** Wraps text into lines that fit `w` at the context's current font. */
function wrap(g: CanvasRenderingContext2D, text: string, w: number) {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const t = line ? `${line} ${word}` : word;
    if (g.measureText(t).width > w && line) {
      out.push(line);
      line = word;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

async function draw(
  p: { eyebrow: string; title: string; headline: string; paragraphs: string[] },
  map: Blob | null,
) {
  const W = 1080;
  const pad = 64;
  const css = getComputedStyle(document.documentElement);
  const font = getComputedStyle(document.body).fontFamily;
  const accent = css.getPropertyValue("--accent").trim() || "#d9b76f";
  const muted = css.getPropertyValue("--muted").trim() || "#a0a3b1";
  const img = map ? await createImageBitmap(map) : null;
  const mapH = img ? Math.round((img.height / img.width) * (W - pad * 2)) : 0;
  const m = document.createElement("canvas").getContext("2d")!;
  m.font = `800 56px ${font}`;
  const titleL = wrap(m, p.title, W - pad * 2);
  m.font = `500 32px ${font}`;
  const headL = wrap(m, p.headline, W - pad * 2);
  m.font = `400 28px ${font}`;
  const body = p.paragraphs.map((x) => wrap(m, x, W - pad * 2));
  // Room for the whole story, up to a tall post; long stories end with "…".
  const bodyLines = body.reduce((n, x) => n + x.length + 1, 0);
  const H = Math.min(
    2400,
    pad +
      50 +
      titleL.length * 66 +
      headL.length * 44 +
      40 +
      mapH +
      40 +
      bodyLines * 40 +
      110,
  );
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = css.getPropertyValue("--bg").trim() || "#0b0c14";
  g.fillRect(0, 0, W, H);
  let y = pad + 10;
  g.fillStyle = accent;
  g.font = `700 26px ${font}`;
  g.fillText(`ON THIS DAY · ${p.eyebrow.toUpperCase()}`, pad, y);
  y += 70;
  g.fillStyle = "#fff";
  g.font = `800 56px ${font}`;
  for (const l of titleL) {
    g.fillText(l, pad, y);
    y += 66;
  }
  g.fillStyle = "#e6e6ea";
  g.font = `500 32px ${font}`;
  for (const l of headL) {
    g.fillText(l, pad, y);
    y += 44;
  }
  y += 16;
  if (img) {
    g.drawImage(img, pad, y, W - pad * 2, mapH);
    y += mapH + 50;
  }
  g.fillStyle = "#d4d6de";
  g.font = `400 28px ${font}`;
  const stop = H - 120;
  outer: for (const para of body) {
    for (const l of para) {
      if (y > stop) {
        g.fillText("…", pad, y);
        break outer;
      }
      g.fillText(l, pad, y);
      y += 40;
    }
    y += 40;
  }
  g.fillStyle = accent;
  g.fillRect(pad, H - 86, W - pad * 2, 2);
  g.font = `700 28px ${font}`;
  g.fillText("SSWX WEATHER CENTER", pad, H - 40);
  g.fillStyle = muted;
  g.font = `600 26px ${font}`;
  const site = "weather.sswx.space/on-this-day";
  g.fillText(site, W - pad - g.measureText(site).width, H - 40);
  return new Promise<Blob>((ok, no) =>
    c.toBlob((b) => (b ? ok(b) : no(new Error("empty"))), "image/png"),
  );
}
