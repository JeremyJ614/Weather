/**
 * Converts between the rich editor's HTML and the news document. Browser-only (uses the
 * DOM). `docToHtml` escapes everything; `domToDoc` reads only known tags and styles, so
 * pasted pages (Google Docs, Word, websites) come in clean, and the server cleans again.
 */
import {
  IMG_SIZES,
  TONES,
  sameMarks,
  type Align,
  type Block,
  type Doc,
  type ImgSize,
  type Item,
  type Run,
  type Tone,
} from "./doc";

type Marks = Omit<Run, "x">;

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function runHtml(r: Run): string {
  let h = esc(r.x).replace(/\n/g, "<br>");
  if (r.code) h = `<code>${h}</code>`;
  if (r.sup) h = `<sup>${h}</sup>`;
  else if (r.sub) h = `<sub>${h}</sub>`;
  if (r.s) h = `<s>${h}</s>`;
  if (r.u) h = `<u>${h}</u>`;
  if (r.i) h = `<i>${h}</i>`;
  if (r.b) h = `<b>${h}</b>`;
  if (r.color || r.hl || r.size || r.font) {
    const st = [
      r.color && `color:${r.color}`,
      r.hl && `background-color:${r.hl}`,
    ]
      .filter(Boolean)
      .join(";");
    h = `<span${st ? ` style="${st}"` : ""}${r.size ? ` data-size="${r.size}"` : ""}${r.font ? ` data-font="${r.font}"` : ""}>${h}</span>`;
  }
  if (r.href) h = `<a href="${esc(r.href)}">${h}</a>`;
  return h;
}

const runsHtml = (c: Run[]) => c.map(runHtml).join("") || "<br>";

export const figureHtml = (
  src: string,
  alt: string,
  cap = "",
  size?: ImgSize,
) =>
  `<figure data-img="" data-size="${size ?? "full"}" contenteditable="false"><img src="${esc(src)}" alt="${esc(alt)}"><figcaption contenteditable="true" data-ph="Add a caption">${esc(cap)}</figcaption></figure>`;

export const videoHtml = (id: string) =>
  `<figure data-video="${esc(id)}" contenteditable="false"><img src="https://i.ytimg.com/vi/${esc(id)}/hqdefault.jpg" alt="YouTube video"></figure>`;

export const tableHtml = (rows: Run[][][], head = false) =>
  `<div data-table=""><table${head ? ' data-head=""' : ""}><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${runsHtml(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;

function blockHtml(b: Block): string {
  switch (b.t) {
    case "p":
    case "h1":
    case "h2":
    case "h3":
    case "quote": {
      const tag = b.t === "quote" ? "blockquote" : b.t;
      const st = [
        b.align && `text-align:${b.align}`,
        b.ind && `padding-inline-start:${b.ind * 1.5}em`,
      ]
        .filter(Boolean)
        .join(";");
      return `<${tag}${st ? ` style="${st}"` : ""}${b.ind ? ` data-ind="${b.ind}"` : ""}>${runsHtml(b.c)}</${tag}>`;
    }
    case "callout":
      return `<aside data-tone="${b.tone}">${runsHtml(b.c)}</aside>`;
    case "ul":
    case "ol":
    case "check":
      return `<${b.t === "ol" ? "ol" : "ul"}${b.t === "check" ? ' data-check=""' : ""}>${b.items
        .map(
          (i) =>
            `<li${i.lvl ? ` data-lvl="${i.lvl}"` : ""}${i.done ? ' data-done=""' : ""}>${runsHtml(i.c)}</li>`,
        )
        .join("")}</${b.t === "ol" ? "ol" : "ul"}>`;
    case "img":
      return figureHtml(b.src, b.alt, b.cap, b.size);
    case "hr":
      return '<hr contenteditable="false">';
    case "table":
      return tableHtml(b.rows, Boolean(b.head));
    case "video":
      return videoHtml(b.id);
  }
}

/** The editor's starting HTML; always ends with an empty line to type on. */
export function docToHtml(doc: Doc | null): string {
  return (doc?.blocks ?? []).map(blockHtml).join("") + "<p><br></p>";
}

// ── DOM → document ─────────────────────────────────────────────────────

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "BLOCKQUOTE",
  "ASIDE",
  "UL",
  "OL",
  "LI",
  "FIGURE",
  "HR",
  "TABLE",
  "PRE",
  "SECTION",
  "ARTICLE",
  "HEADER",
  "FOOTER",
  "MAIN",
  "NAV",
  "IMG",
  "DL",
  "DD",
  "DT",
]);

/** "rgb(12, 34, 56)" or "#abc" → "#0c2238"; null for transparent or unreadable. */
export function toHex(c: string | null | undefined): string | null {
  if (!c) return null;
  const v = c.trim().toLowerCase();
  let r: number, g: number, b: number;
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(v);
  if (m) {
    if (m[4] !== undefined && Number(m[4]) < 0.1) return null;
    [r, g, b] = [+m[1], +m[2], +m[3]];
  } else if (/^#[0-9a-f]{6}$/.test(v)) {
    [r, g, b] = [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
  } else if (/^#[0-9a-f]{3}$/.test(v)) {
    [r, g, b] = [1, 2, 3].map((i) => parseInt(v[i] + v[i], 16));
  } else return null;
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

const FONT_SIZE: Record<string, Run["size"] | null> = {
  "1": "sm",
  "2": "sm",
  "3": null,
  "4": "lg",
  "5": "lg",
  "6": "xl",
  "7": "xl",
};

function marksOf(el: HTMLElement, m: Marks): Marks {
  const out: Marks = { ...m };
  const tag = el.tagName;
  const st = el.style;
  if (tag === "B" || tag === "STRONG") out.b = 1;
  if (tag === "I" || tag === "EM") out.i = 1;
  if (tag === "U" || tag === "INS") out.u = 1;
  if (tag === "S" || tag === "STRIKE" || tag === "DEL") out.s = 1;
  if (tag === "CODE" || tag === "KBD") out.code = 1;
  if (tag === "SUP") {
    out.sup = 1;
    delete out.sub;
  }
  if (tag === "SUB") {
    out.sub = 1;
    delete out.sup;
  }
  if (tag === "A") {
    const h = el.getAttribute("href");
    if (h) out.href = h;
  }
  if (tag === "FONT") {
    const c = toHex(el.getAttribute("color"));
    if (c) out.color = c;
    const size = el.getAttribute("size");
    if (size && size in FONT_SIZE) {
      const v = FONT_SIZE[size];
      if (v) out.size = v;
      else delete out.size;
    }
    const face = el.getAttribute("face");
    if (face === "display" || face === "mono") out.font = face;
    else if (face) delete out.font;
  }
  // Inline styles (our spans, and pasted Google Docs / Word / web text).
  const w = st.fontWeight;
  if (w === "bold" || Number(w) >= 600) out.b = 1;
  else if (w === "normal" || (w && Number(w) < 600)) delete out.b;
  if (st.fontStyle === "italic") out.i = 1;
  else if (st.fontStyle === "normal") delete out.i;
  const deco = `${st.textDecoration} ${st.textDecorationLine}`;
  if (deco.includes("underline")) out.u = 1;
  if (deco.includes("line-through")) out.s = 1;
  if (st.verticalAlign === "super") out.sup = 1;
  if (st.verticalAlign === "sub") out.sub = 1;
  const color = toHex(st.color);
  if (color) out.color = color;
  const hl = toHex(st.backgroundColor);
  if (hl) out.hl = hl;
  else if (st.backgroundColor === "transparent") delete out.hl;
  const ds = el.dataset.size;
  if (ds === "sm" || ds === "lg" || ds === "xl") out.size = ds;
  const df = el.dataset.font;
  if (df === "display" || df === "mono") out.font = df;
  return out;
}

/** Drops colors that would vanish on the dark theme (pasted black text, white highlights). */
function readable(m: Marks): Marks {
  const out = { ...m };
  if (out.color && lum(out.color) < 0.18) delete out.color;
  if (out.hl && lum(out.hl) > 0.92) delete out.hl;
  return out;
}

type Ctx = { images: Block[] };

function inlineRuns(node: Node, m: Marks, runs: Run[], ctx: Ctx, pre = false) {
  if (node.nodeType === Node.TEXT_NODE) {
    let x = (node.textContent ?? "").replace(/ /g, " ");
    if (!pre) x = x.replace(/[\t\n\r ]+/g, " ");
    if (x) runs.push({ ...readable(m), x });
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  const tag = el.tagName;
  if (tag === "BR") {
    runs.push({ ...readable(m), x: "\n" });
    return;
  }
  if (tag === "IMG") {
    const img = imgBlock(el as HTMLImageElement, el.closest("figure"));
    if (img) ctx.images.push(img);
    return;
  }
  if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEMPLATE") return;
  const mm = marksOf(el, m);
  const isBlock = BLOCK_TAGS.has(tag);
  if (isBlock && runs.length && !runs.at(-1)!.x.endsWith("\n"))
    runs.push({ ...readable(mm), x: "\n" });
  for (const c of Array.from(el.childNodes))
    inlineRuns(c, mm, runs, ctx, pre || tag === "PRE");
}

/** Merges neighbours with the same marks and trims the block's outer whitespace. */
function tidy(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    const prev = out.at(-1);
    if (prev && sameMarks(prev, r)) prev.x += r.x;
    else out.push({ ...r });
  }
  if (out.length) out[0].x = out[0].x.replace(/^[ \n]+/, "");
  if (out.length) out[out.length - 1].x = out.at(-1)!.x.replace(/[ \n]+$/, "");
  return out.filter((r) => r.x);
}

function runsOf(el: Element, ctx: Ctx, base: Marks = {}): Run[] {
  const runs: Run[] = [];
  for (const c of Array.from(el.childNodes)) inlineRuns(c, base, runs, ctx);
  return tidy(runs);
}

function imgBlock(img: HTMLImageElement, fig: Element | null): Block | null {
  const src = img.getAttribute("src");
  if (!src || src.startsWith("data:")) return null;
  const b: Block = { t: "img", src, alt: img.getAttribute("alt") ?? "" };
  const cap = fig?.querySelector("figcaption")?.textContent?.trim();
  if (cap) b.cap = cap;
  const size = (fig as HTMLElement | null)?.dataset.size as ImgSize;
  if (IMG_SIZES.includes(size) && size !== "full") b.size = size;
  return b;
}

function alignOf(el: HTMLElement): Align | undefined {
  const a = (
    el.style.textAlign ||
    el.getAttribute("align") ||
    ""
  ).toLowerCase();
  return a === "center" || a === "right" || a === "justify" ? a : undefined;
}

function listItems(list: Element, lvl: number, items: Item[], ctx: Ctx) {
  for (const li of Array.from(list.children)) {
    if (li.tagName === "UL" || li.tagName === "OL") {
      listItems(li, lvl + 1, items, ctx);
      continue;
    }
    if (li.tagName !== "LI") continue;
    const own = document.createElement("div");
    const nested: Element[] = [];
    for (const c of Array.from(li.childNodes)) {
      if (c.nodeType === 1 && ["UL", "OL"].includes((c as Element).tagName))
        nested.push(c as Element);
      else own.appendChild(c.cloneNode(true));
    }
    const el = li as HTMLElement;
    const item: Item = { c: runsOf(own, ctx) };
    const l = lvl + (Number(el.dataset.lvl) || 0);
    if (l > 0) item.lvl = Math.min(l, 5);
    if (el.dataset.done !== undefined) item.done = 1;
    if (item.c.length || !nested.length) items.push(item);
    for (const n of nested) listItems(n, l + 1, items, ctx);
  }
}

function blocksOf(parent: Element, out: Block[], ctx: Ctx) {
  let pending: Run[] = [];
  const flush = () => {
    const c = tidy(pending);
    if (c.length) out.push({ t: "p", c });
    pending = [];
    out.push(...ctx.images.splice(0));
  };
  for (const node of Array.from(parent.childNodes)) {
    const el = node as HTMLElement;
    if (node.nodeType !== Node.ELEMENT_NODE || !BLOCK_TAGS.has(el.tagName)) {
      inlineRuns(node, {}, pending, ctx);
      continue;
    }
    flush();
    const tag = el.tagName;
    const hasBlocks = Array.from(el.children).some(
      (c) => BLOCK_TAGS.has(c.tagName) && c.tagName !== "IMG",
    );
    if (tag === "HR") out.push({ t: "hr" });
    else if (tag === "IMG") {
      const b = imgBlock(el as HTMLImageElement, null);
      if (b) out.push(b);
    } else if (tag === "FIGURE") {
      const vid = el.dataset.video;
      const img = el.querySelector("img");
      if (vid) out.push({ t: "video", id: vid });
      else if (img) {
        const b = imgBlock(img, el);
        if (b) out.push(b);
      }
    } else if (
      tag === "TABLE" ||
      (tag === "DIV" && el.dataset.table !== undefined)
    ) {
      const table = tag === "TABLE" ? el : el.querySelector("table");
      if (!table) continue;
      const rows = Array.from(table.querySelectorAll("tr")).map((tr) =>
        Array.from(tr.children)
          .filter((c) => c.tagName === "TD" || c.tagName === "TH")
          .map((c) => runsOf(c, ctx)),
      );
      const head =
        (table as HTMLElement).dataset.head !== undefined ||
        Boolean(table.querySelector("tr:first-child > th"));
      if (rows.length)
        out.push(head ? { t: "table", rows, head: 1 } : { t: "table", rows });
    } else if (tag === "UL" || tag === "OL") {
      const items: Item[] = [];
      listItems(el, 0, items, ctx);
      const t =
        el.dataset.check !== undefined ? "check" : tag === "OL" ? "ol" : "ul";
      if (items.length) out.push({ t, items });
    } else if (tag === "ASIDE") {
      const tone = (
        TONES.includes(el.dataset.tone as Tone) ? el.dataset.tone : "note"
      ) as Tone;
      out.push({ t: "callout", tone, c: runsOf(el, ctx) });
    } else if (tag === "BLOCKQUOTE") {
      out.push({ t: "quote", c: runsOf(el, ctx) });
    } else if (/^H[1-6]$/.test(tag)) {
      const n = Math.min(3, Number(tag[1]));
      const b: Block = { t: `h${n}` as "h1", c: runsOf(el, ctx) };
      const a = alignOf(el);
      if (a) b.align = a;
      out.push(b);
    } else if (tag === "PRE") {
      out.push({ t: "p", c: runsOf(el, ctx, { code: 1 }) });
    } else if (hasBlocks) {
      blocksOf(el, out, ctx);
    } else {
      const b: Block = { t: "p", c: runsOf(el, ctx) };
      const a = alignOf(el);
      if (a) b.align = a;
      const ind = Number(el.dataset.ind);
      if (ind > 0) b.ind = Math.min(ind, 6);
      out.push(b);
    }
    out.push(...ctx.images.splice(0));
  }
  flush();
}

/** Reads the editor (or pasted HTML) back into a document. */
export function domToDoc(root: Element): Doc {
  const blocks: Block[] = [];
  blocksOf(root, blocks, { images: [] });
  return { v: 2, blocks };
}
