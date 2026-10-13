/**
 * SSWX News rich documents. The editor saves this structure (never HTML); the server
 * rebuilds it through `cleanDoc`, which keeps only known fields with checked values, and
 * pages render it as React elements. Nothing a post contains can run as code.
 */

export type Size = "sm" | "lg" | "xl";
export type Font = "display" | "mono";
export type Run = {
  x: string;
  b?: 1;
  i?: 1;
  u?: 1;
  s?: 1;
  code?: 1;
  sup?: 1;
  sub?: 1;
  color?: string;
  hl?: string;
  href?: string;
  size?: Size;
  font?: Font;
};
export type Align = "left" | "center" | "right" | "justify";
export type Tone = "note" | "tip" | "warn" | "alert";
export type ImgSize = "small" | "half" | "wide" | "full";
export type Item = { c: Run[]; lvl?: number; done?: 1 };
export type Block =
  | {
      t: "p" | "h1" | "h2" | "h3" | "quote";
      c: Run[];
      align?: Align;
      ind?: number;
    }
  | { t: "callout"; tone: Tone; c: Run[] }
  | { t: "ul" | "ol" | "check"; items: Item[] }
  | { t: "img"; src: string; alt: string; cap?: string; size?: ImgSize }
  | { t: "hr" }
  | { t: "table"; head?: 1; rows: Run[][][] }
  | { t: "video"; id: string };
export type Doc = { v: 2; blocks: Block[] };

export const TONES: Tone[] = ["note", "tip", "warn", "alert"];
export const IMG_SIZES: ImgSize[] = ["small", "half", "wide", "full"];
const TEXT_BLOCKS = new Set(["p", "h1", "h2", "h3", "quote"]);
const ALIGNS = new Set(["left", "center", "right", "justify"]);
const HEX = /^#[0-9a-f]{6}$/i;
export const YT_ID = /^[\w-]{11}$/;

/** Links may go to the web, an email address or a page of this app. */
export function safeLink(url: string): string | null {
  const u = url.trim();
  if (/^\/(?!\/)[\w\-./?=&#%]*$/.test(u)) return u;
  if (/^mailto:[^\s<>"]+@[^\s<>"]+$/i.test(u)) return u;
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:" ? p.href : null;
  } catch {
    return null;
  }
}

/** The YouTube video id in a watch, share, shorts or embed link (or a bare id). */
export function youtubeId(url: string): string | null {
  const u = url.trim();
  if (YT_ID.test(u)) return u;
  const m =
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(
      u,
    );
  return m ? m[1] : null;
}

type Limits = { text: number };

function cleanRuns(raw: unknown, lim: Limits): Run[] {
  if (!Array.isArray(raw)) return [];
  const out: Run[] = [];
  for (const r of raw.slice(0, 400)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o.x !== "string" || !o.x) continue;
    const x = o.x.slice(0, Math.max(0, Math.min(5000, lim.text)));
    lim.text -= x.length;
    if (!x) break;
    const run: Run = { x };
    for (const k of ["b", "i", "u", "s", "code", "sup", "sub"] as const)
      if (o[k]) run[k] = 1;
    if (run.sup && run.sub) delete run.sub;
    if (typeof o.color === "string" && HEX.test(o.color)) run.color = o.color;
    if (typeof o.hl === "string" && HEX.test(o.hl)) run.hl = o.hl;
    if (typeof o.href === "string") {
      const h = safeLink(o.href);
      if (h) run.href = h;
    }
    if (o.size === "sm" || o.size === "lg" || o.size === "xl")
      run.size = o.size;
    if (o.font === "display" || o.font === "mono") run.font = o.font;
    const prev = out.at(-1);
    if (prev && sameMarks(prev, run)) prev.x += run.x;
    else out.push(run);
  }
  return out;
}

export function sameMarks(a: Run, b: Run): boolean {
  const ka = Object.keys(a).filter((k) => k !== "x");
  const kb = Object.keys(b).filter((k) => k !== "x");
  return (
    ka.length === kb.length &&
    ka.every((k) => a[k as keyof Run] === b[k as keyof Run])
  );
}

/**
 * Rebuilds a document from untrusted input, keeping only known fields with valid
 * values. `imageOk` decides which image addresses are allowed (our own bucket).
 * Returns null when nothing usable is left.
 */
export function cleanDoc(
  raw: unknown,
  imageOk: (src: string) => boolean,
): Doc | null {
  if (!raw || typeof raw !== "object") return null;
  const list = (raw as { blocks?: unknown }).blocks;
  if (!Array.isArray(list)) return null;
  const lim: Limits = { text: 60000 };
  const blocks: Block[] = [];
  for (const b of list.slice(0, 800)) {
    if (!b || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    const t = o.t;
    if (typeof t !== "string") continue;
    if (TEXT_BLOCKS.has(t)) {
      const blk: Block = {
        t: t as "p",
        c: cleanRuns(o.c, lim),
      };
      if (
        typeof o.align === "string" &&
        ALIGNS.has(o.align) &&
        o.align !== "left"
      )
        blk.align = o.align as Align;
      const ind = Number(o.ind);
      if (Number.isInteger(ind) && ind > 0) blk.ind = Math.min(ind, 6);
      blocks.push(blk);
    } else if (t === "callout") {
      const tone = TONES.includes(o.tone as Tone) ? (o.tone as Tone) : "note";
      blocks.push({ t, tone, c: cleanRuns(o.c, lim) });
    } else if (t === "ul" || t === "ol" || t === "check") {
      if (!Array.isArray(o.items)) continue;
      const items: Item[] = [];
      for (const it of o.items.slice(0, 300)) {
        if (!it || typeof it !== "object") continue;
        const io = it as Record<string, unknown>;
        const item: Item = { c: cleanRuns(io.c, lim) };
        const lvl = Number(io.lvl);
        if (Number.isInteger(lvl) && lvl > 0) item.lvl = Math.min(lvl, 5);
        if (t === "check" && io.done) item.done = 1;
        items.push(item);
      }
      if (items.length) blocks.push({ t, items });
    } else if (t === "img") {
      if (typeof o.src !== "string" || !imageOk(o.src)) continue;
      const img: Block = {
        t,
        src: o.src,
        alt: typeof o.alt === "string" ? o.alt.slice(0, 200) : "",
      };
      if (typeof o.cap === "string" && o.cap.trim())
        img.cap = o.cap.trim().slice(0, 300);
      if (IMG_SIZES.includes(o.size as ImgSize) && o.size !== "full")
        img.size = o.size as ImgSize;
      blocks.push(img);
    } else if (t === "hr") {
      blocks.push({ t });
    } else if (t === "table") {
      if (!Array.isArray(o.rows)) continue;
      const rows = o.rows
        .slice(0, 30)
        .filter(Array.isArray)
        .map((r: unknown[]) =>
          r.slice(0, 8).map((cell) => cleanRuns(cell, lim)),
        );
      const cols = Math.max(0, ...rows.map((r) => r.length));
      if (!rows.length || !cols) continue;
      // Square the grid so every row has the same number of cells.
      for (const r of rows) while (r.length < cols) r.push([]);
      const tbl: Block = { t, rows };
      if (o.head) tbl.head = 1;
      blocks.push(tbl);
    } else if (t === "video") {
      if (typeof o.id === "string" && YT_ID.test(o.id))
        blocks.push({ t, id: o.id });
    }
  }
  // Trailing empty paragraphs are the editor's caret line, not content.
  while (blocks.length) {
    const last = blocks.at(-1)!;
    if (last.t === "p" && !last.c.some((r) => r.x.trim())) blocks.pop();
    else break;
  }
  return blocks.length ? { v: 2, blocks } : null;
}

const runsText = (c: Run[]) => c.map((r) => r.x).join("");

/** Plain text of a document, for excerpts and search. */
export function plainText(doc: Doc): string {
  return doc.blocks
    .map((b) => {
      switch (b.t) {
        case "ul":
        case "ol":
        case "check":
          return b.items.map((i) => runsText(i.c)).join("\n");
        case "img":
          return b.cap ?? "";
        case "table":
          return b.rows.map((r) => r.map(runsText).join(" · ")).join("\n");
        case "hr":
        case "video":
          return "";
        default:
          return runsText(b.c);
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Inline Markdown (**bold**, *italic*, [text](url)) as runs. */
export function mdRuns(text: string, base: Omit<Run, "x"> = {}): Run[] {
  const out: Run[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ ...base, x: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push(...mdRuns(m[1], { ...base, b: 1 }));
    else if (m[2] !== undefined) out.push(...mdRuns(m[2], { ...base, i: 1 }));
    else {
      const href = safeLink(m[4]);
      out.push(href ? { ...base, x: m[3], href } : { ...base, x: m[3] });
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ ...base, x: text.slice(last) });
  return out;
}

/** An older Markdown post as a document, so it opens in the rich editor unchanged. */
export function fromMarkdown(src: string): Doc {
  const blocks: Block[] = [];
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ t: "p", c: mdRuns(para.join(" ")) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^(#{1,3})\s+(.+)$/.exec(line);
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line);
    if (h) {
      flush();
      blocks.push({ t: `h${h[1].length}` as "h1", c: mdRuns(h[2]) });
    } else if (img) {
      flush();
      blocks.push({ t: "img", alt: img[1], src: img[2] });
    } else if (line.startsWith("> ")) {
      flush();
      blocks.push({ t: "quote", c: mdRuns(line.slice(2)) });
    } else if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      flush();
      const ol = /^\d+\./.test(line);
      const re = ol ? /^\d+\.\s+(.*)$/ : /^[-*]\s+(.*)$/;
      const items: Item[] = [];
      while (i < lines.length && re.test(lines[i].trim())) {
        items.push({ c: mdRuns(re.exec(lines[i].trim())![1]) });
        i++;
      }
      i--;
      blocks.push({ t: ol ? "ol" : "ul", items });
    } else para.push(line);
  }
  flush();
  return { v: 2, blocks };
}
