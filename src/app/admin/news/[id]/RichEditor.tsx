"use client";

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  CalendarDays,
  Code,
  Eraser,
  Eye,
  Highlighter,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Plus,
  Quote,
  Redo2,
  Strikethrough,
  Subscript,
  Superscript,
  Table2,
  Trash2,
  Type,
  Underline,
  Undo2,
  Unlink,
  Youtube,
  X,
} from "lucide-react";
import {
  cleanDoc,
  plainText,
  safeLink,
  youtubeId,
  type Doc,
  type ImgSize,
  type Tone,
} from "@/lib/news/doc";
import {
  docToHtml,
  domToDoc,
  figureHtml,
  tableHtml,
  videoHtml,
} from "@/lib/news/html";
import { RichBody, richStyles } from "@/lib/news/RichBody";
import s from "./RichEditor.module.css";

const TEXT_COLORS = [
  "#f8fafc",
  "#cbd5e1",
  "#94a3b8",
  "#f87171",
  "#fb923c",
  "#fbbf24",
  "#facc15",
  "#a3e635",
  "#34d399",
  "#22d3ee",
  "#60a5fa",
  "#818cf8",
  "#c084fc",
  "#f472b6",
];
const HIGHLIGHTS = [
  "#7f1d1d",
  "#7c2d12",
  "#713f12",
  "#365314",
  "#064e3b",
  "#164e63",
  "#1e3a8a",
  "#4c1d95",
  "#831843",
  "#334155",
];
const STYLES = [
  ["p", "Normal text"],
  ["h1", "Title"],
  ["h2", "Heading"],
  ["h3", "Subheading"],
  ["blockquote", "Quote"],
] as const;
const SIZES = [
  ["2", "Small"],
  ["3", "Normal"],
  ["5", "Large"],
  ["7", "Huge"],
] as const;
const FONTS = [
  ["default", "Default"],
  ["display", "Display"],
  ["mono", "Mono"],
] as const;
const TONE_LABEL: Record<Tone, string> = {
  note: "Note",
  tip: "Tip",
  warn: "Warning",
  alert: "Alert",
};
const IMG_LABEL: Record<ImgSize, string> = {
  small: "Small",
  half: "Half",
  wide: "Wide",
  full: "Full",
};

type Panel = "text" | "para" | "insert" | null;
type Active = {
  b: boolean;
  i: boolean;
  u: boolean;
  s: boolean;
  sup: boolean;
  sub: boolean;
  block: string;
  list: "ul" | "ol" | "check" | null;
  align: string;
  table: boolean;
  link: boolean;
};
const NONE: Active = {
  b: false,
  i: false,
  u: false,
  s: false,
  sup: false,
  sub: false,
  block: "p",
  list: null,
  align: "left",
  table: false,
  link: false,
};

const now = () => Date.now();
const exec = (cmd: string, value?: string) =>
  document.execCommand(cmd, false, value);

/** Markdown-style shortcuts typed at the start of a line (like Docs' autoformat). */
const AUTO: [RegExp, string, string?][] = [
  [/^# $/, "formatBlock", "h1"],
  [/^## $/, "formatBlock", "h2"],
  [/^### $/, "formatBlock", "h3"],
  [/^> $/, "formatBlock", "blockquote"],
  [/^[-*] $/, "insertUnorderedList"],
  [/^1[.)] $/, "insertOrderedList"],
  [/^\[ ?\] $/, "check"],
  [/^--- $/, "hr"],
];

/**
 * The SSWX News editor: what you see is what readers get (it uses the reader's own
 * styles). Docs-mobile features and more: styles, sizes, fonts, colors, highlights,
 * alignment, three list kinds, indents, callouts, tables, captioned images with sizes,
 * YouTube, links, undo/redo, Markdown-style shortcuts, clean paste from Google Docs and
 * the web, word count and a local autosave. Saves a validated document, never HTML.
 */
export function RichEditor({
  postId,
  initial,
  savedAt,
  upload,
  onBusy,
}: {
  postId: string;
  initial: Doc | null;
  savedAt: string | null;
  upload: (file: File) => Promise<string>;
  onBusy: (busy: boolean) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const docIn = useRef<HTMLInputElement>(null);
  const bodyIn = useRef<HTMLInputElement>(null);
  const range = useRef<Range | null>(null);
  const timer = useRef(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [active, setActive] = useState<Active>(NONE);
  // The tapped image or video, and a snapshot of it for the toolbar.
  const figEl = useRef<HTMLElement | null>(null);
  const [fig, setFig] = useState<{ video: boolean; size: string } | null>(null);
  const [preview, setPreview] = useState<Doc | null>(null);
  const [words, setWords] = useState(() =>
    initial ? plainText(initial).split(/\s+/).filter(Boolean).length : 0,
  );
  const [ask, setAsk] = useState<null | "link" | "video">(null);
  const [askVal, setAskVal] = useState("");
  const [restore, setRestore] = useState<{ at: number; doc: Doc } | null>(null);
  const key = `sswx-news-draft:${postId}`;
  const imageOk = (src: string) =>
    src.startsWith(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/news/`,
    );

  /** Writes the document into the form's hidden fields (and the local autosave). */
  const sync = (store = true, count = true) => {
    const el = root.current;
    if (!el) return null;
    const doc = cleanDoc(domToDoc(el), imageOk);
    const text = doc ? plainText(doc) : "";
    if (docIn.current) docIn.current.value = doc ? JSON.stringify(doc) : "";
    if (bodyIn.current) bodyIn.current.value = text.slice(0, 20000);
    if (count) setWords(text.split(/\s+/).filter(Boolean).length);
    if (store)
      try {
        localStorage.setItem(key, JSON.stringify({ at: now(), doc }));
      } catch {
        /* private mode: no autosave */
      }
    return doc;
  };
  const changed = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => sync(), 400);
  };

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.innerHTML = docToHtml(initial);
    exec("defaultParagraphSeparator", "p");
    sync(false, false);
    try {
      const raw = localStorage.getItem(key);
      const saved = raw ? (JSON.parse(raw) as { at: number; doc: Doc }) : null;
      const server = savedAt ? Date.parse(savedAt) : 0;
      if (
        saved?.doc &&
        saved.at > server + 2000 &&
        JSON.stringify(saved.doc) !== JSON.stringify(initial)
      )
        queueMicrotask(() => setRestore(saved));
    } catch {
      /* nothing saved */
    }
    // Save the hidden fields right before the form submits.
    const form = el.closest("form");
    const onSubmit = () => {
      sync(false);
    };
    form?.addEventListener("submit", onSubmit, true);
    const onSel = () => {
      const sel = document.getSelection();
      if (!sel?.rangeCount || !el.contains(sel.anchorNode)) return;
      range.current = sel.getRangeAt(0).cloneRange();
      setActive(readActive(el));
    };
    document.addEventListener("selectionchange", onSel);
    return () => {
      form?.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("selectionchange", onSel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only: the editor owns its DOM after this
  }, []);

  /** Puts the caret back where it was before a toolbar field took focus. */
  const focus = () => {
    const el = root.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const sel = document.getSelection();
    if (range.current && sel) {
      sel.removeAllRanges();
      sel.addRange(range.current);
    }
  };
  const run = (fn: () => void) => {
    focus();
    exec("styleWithCSS", "false");
    fn();
    normalize(root.current);
    tidyFonts(root.current);
    setActive(readActive(root.current!));
    changed();
  };
  const cmd = (c: string, v?: string) => run(() => exec(c, v));
  const insert = (html: string) =>
    run(() => exec("insertHTML", `${html}<p><br></p>`));

  const blockEl = () => {
    const el = root.current;
    let n: Node | null = document.getSelection()?.anchorNode ?? null;
    while (n && n.parentNode !== el) n = n.parentNode;
    return n instanceof HTMLElement ? n : null;
  };
  const itemEl = () => {
    const n = document.getSelection()?.anchorNode;
    const e = n instanceof Element ? n : n?.parentElement;
    const li = e?.closest("li");
    return li && root.current?.contains(li) ? li : null;
  };

  const setList = (kind: "ul" | "ol" | "check") =>
    run(() => {
      const cur = readActive(root.current!).list;
      if (kind === "check") {
        if (cur === "check") exec("insertUnorderedList");
        else {
          if (cur !== "ul") exec("insertUnorderedList");
          itemEl()?.closest("ul")?.setAttribute("data-check", "");
        }
      } else {
        if (cur === "check")
          itemEl()?.closest("ul")?.removeAttribute("data-check");
        if (!(cur === "check" && kind === "ul"))
          exec(kind === "ol" ? "insertOrderedList" : "insertUnorderedList");
      }
    });

  const indent = (d: 1 | -1) =>
    run(() => {
      const li = itemEl();
      const target = li ?? blockEl();
      if (!target) return;
      const now = Number(target.dataset[li ? "lvl" : "ind"]) || 0;
      const next = Math.max(0, Math.min(li ? 5 : 6, now + d));
      if (li) {
        if (next) li.dataset.lvl = String(next);
        else delete li.dataset.lvl;
      } else {
        if (next) target.dataset.ind = String(next);
        else delete target.dataset.ind;
        target.style.paddingInlineStart = next ? `${next * 1.5}em` : "";
      }
    });

  const callout = (tone: Tone | null) =>
    run(() => {
      const b = blockEl();
      if (!b) return;
      if (b.tagName === "ASIDE") {
        if (tone) b.dataset.tone = tone;
        else {
          const p = document.createElement("p");
          p.append(...Array.from(b.childNodes));
          b.replaceWith(p);
        }
        return;
      }
      if (!tone || ["UL", "OL", "FIGURE", "HR", "DIV"].includes(b.tagName))
        return;
      const a = document.createElement("aside");
      a.dataset.tone = tone;
      a.append(...Array.from(b.childNodes));
      b.replaceWith(a);
      const r = document.createRange();
      r.selectNodeContents(a);
      r.collapse(false);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(r);
    });

  const addImage = (file: File) => {
    onBusy(true);
    upload(file)
      .then((url) =>
        insert(
          figureHtml(url, file.name.replace(/\.[^.]+$/, "").slice(0, 120)),
        ),
      )
      .catch((e: Error) => alert(e.message))
      .finally(() => onBusy(false));
  };
  const pickImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => input.files?.[0] && addImage(input.files[0]);
    input.click();
  };

  const table = (r: number, c: number) => {
    insert(
      tableHtml(
        Array.from({ length: r }, () => Array.from({ length: c }, () => [])),
        true,
      ).replace("<table", '<table data-new=""'),
    );
    // Start typing in the new table's first cell.
    const tbl = root.current?.querySelector("table[data-new]");
    const cell = tbl?.querySelector("td");
    tbl?.removeAttribute("data-new");
    if (cell) {
      const rg = document.createRange();
      rg.selectNodeContents(cell);
      rg.collapse(true);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(rg);
      range.current = rg;
    }
  };
  const tableEdit = (op: "row" | "col" | "delRow" | "delCol" | "del") =>
    run(() => {
      const n = document.getSelection()?.anchorNode;
      const cell = (n instanceof Element ? n : n?.parentElement)?.closest(
        "td,th",
      ) as HTMLTableCellElement | null;
      const tbl = cell?.closest("table");
      const tr = cell?.parentElement as HTMLTableRowElement | undefined;
      if (!cell || !tbl || !tr) return;
      const idx = cell.cellIndex;
      if (op === "row") {
        const copy = tr.cloneNode(true) as HTMLTableRowElement;
        copy.querySelectorAll("td,th").forEach((c) => (c.innerHTML = "<br>"));
        tr.after(copy);
      } else if (op === "col") {
        tbl.querySelectorAll("tr").forEach((row) => {
          const td = document.createElement("td");
          td.innerHTML = "<br>";
          row.children[idx]?.after(td);
        });
      } else if (op === "delRow") {
        if (tbl.rows.length > 1) tr.remove();
      } else if (op === "delCol") {
        if (tr.cells.length > 1)
          tbl
            .querySelectorAll("tr")
            .forEach((row) => row.children[idx]?.remove());
      } else tbl.closest("[data-table]")?.remove();
    });

  const submitAsk = () => {
    const v = askVal.trim();
    if (ask === "link") {
      const href = safeLink(/^[\w-]+(\.[\w-]+)+/.test(v) ? `https://${v}` : v);
      if (!href) return alert("That link isn't a web, email or app address.");
      run(() => {
        if (document.getSelection()?.isCollapsed) {
          const a = document.createElement("a");
          a.href = href;
          a.textContent = v.replace(/^https?:\/\//, "");
          exec("insertHTML", a.outerHTML);
        } else exec("createLink", href);
      });
    } else if (ask === "video") {
      const id = youtubeId(v);
      if (!id) return alert("Paste a YouTube link.");
      insert(videoHtml(id));
    }
    setAsk(null);
    setAskVal("");
  };

  const onInput = (e: FormEvent<HTMLDivElement>) => {
    const ev = e.nativeEvent as InputEvent;
    if (ev.inputType === "insertText" && ev.data === " ") {
      const b = blockEl();
      const text = (b?.textContent ?? "").replace(/ /g, " ");
      const hit =
        b &&
        ["P", "ASIDE", "BLOCKQUOTE"].includes(b.tagName) &&
        AUTO.find(([re]) => re.test(text));
      if (hit) {
        b.innerHTML = "<br>";
        const r = document.createRange();
        r.setStart(b, 0);
        r.collapse(true);
        document.getSelection()?.removeAllRanges();
        document.getSelection()?.addRange(r);
        range.current = r;
        const [, c, v] = hit;
        if (c === "check") setList("check");
        else if (c === "hr") {
          const hr = document.createElement("hr");
          hr.contentEditable = "false";
          const p = document.createElement("p");
          p.innerHTML = "<br>";
          b.replaceWith(hr, p);
          r.setStart(p, 0);
          r.collapse(true);
          document.getSelection()?.removeAllRanges();
          document.getSelection()?.addRange(r);
          changed();
        } else cmd(c, v);
        return;
      }
    }
    normalize(root.current);
    changed();
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const file = Array.from(e.clipboardData.files).find((f) =>
      f.type.startsWith("image/"),
    );
    if (file) {
      e.preventDefault();
      return addImage(file);
    }
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    e.preventDefault();
    if (html) {
      const dom = new DOMParser().parseFromString(html, "text/html");
      const doc = cleanDoc(domToDoc(dom.body), imageOk);
      if (doc) {
        const out = docToHtml(doc).replace(/<p><br><\/p>$/, "");
        return run(() => exec("insertHTML", out));
      }
    }
    if (text) run(() => exec("insertText", text));
  };

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    const f = t.closest(
      "figure[data-img],figure[data-video]",
    ) as HTMLElement | null;
    figEl.current = f && !t.closest("figcaption") ? f : null;
    setFig(
      figEl.current
        ? {
            video: figEl.current.dataset.video !== undefined,
            size: figEl.current.dataset.size ?? "full",
          }
        : null,
    );
    const li = t.closest("ul[data-check] > li") as HTMLElement | null;
    if (li && e.clientX - li.getBoundingClientRect().left < 30) {
      if (li.dataset.done !== undefined) delete li.dataset.done;
      else li.dataset.done = "";
      changed();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && (e.target as HTMLElement).closest?.("figcaption"))
      e.preventDefault();
    const sel = document.getSelection();
    const cap = sel?.anchorNode?.parentElement?.closest("figcaption");
    if (e.key === "Enter" && cap) e.preventDefault();
    // Enter on an empty callout or quote line leaves it, like an empty list item does.
    const b = blockEl();
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      b &&
      (b.tagName === "ASIDE" || b.tagName === "BLOCKQUOTE") &&
      !(b.textContent ?? "").trim() &&
      !b.querySelector("img")
    ) {
      e.preventDefault();
      const p = document.createElement("p");
      p.innerHTML = "<br>";
      b.replaceWith(p);
      const rg = document.createRange();
      rg.setStart(p, 0);
      rg.collapse(true);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(rg);
      changed();
      return;
    }
    if (e.key === "Tab" && itemEl()) {
      e.preventDefault();
      indent(e.shiftKey ? -1 : 1);
    }
  };

  const figSize = (e: MouseEvent<HTMLButtonElement>) => {
    const size = e.currentTarget.dataset.size as ImgSize;
    const f = figEl.current;
    if (!f) return;
    f.dataset.size = size;
    setFig({ video: false, size });
    changed();
  };

  const toggle = (p: Panel) => setPanel(panel === p ? null : p);

  return (
    <div className={s.wrap}>
      <input type="hidden" name="doc" ref={docIn} />
      <input type="hidden" name="body" ref={bodyIn} />
      {restore && (
        <div className={s.restore} role="status">
          <span>
            Unsaved changes from{" "}
            {new Date(restore.at).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            .
          </span>
          <button
            type="button"
            onClick={() => {
              if (root.current) root.current.innerHTML = docToHtml(restore.doc);
              sync(false);
              setRestore(null);
            }}
          >
            Restore
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem(key);
              } catch {
                /* ignore */
              }
              setRestore(null);
            }}
          >
            Discard
          </button>
        </div>
      )}

      <div className={s.bar} role="toolbar" aria-label="Formatting">
        <div className={s.row}>
          <Btn label="Undo" onClick={() => cmd("undo")}>
            <Undo2 />
          </Btn>
          <Btn label="Redo" onClick={() => cmd("redo")}>
            <Redo2 />
          </Btn>
          <span className={s.sep} />
          <Btn
            label="Text style"
            on={panel === "text"}
            onClick={() => toggle("text")}
          >
            <Type />
          </Btn>
          <Btn label="Bold" on={active.b} onClick={() => cmd("bold")}>
            <Bold />
          </Btn>
          <Btn label="Italic" on={active.i} onClick={() => cmd("italic")}>
            <Italic />
          </Btn>
          <Btn label="Underline" on={active.u} onClick={() => cmd("underline")}>
            <Underline />
          </Btn>
          <span className={s.sep} />
          <Btn
            label="Paragraph"
            on={panel === "para"}
            onClick={() => toggle("para")}
          >
            <Pilcrow />
          </Btn>
          <Btn
            label="Insert"
            on={panel === "insert"}
            onClick={() => toggle("insert")}
          >
            <Plus />
          </Btn>
          <Btn
            label="Preview"
            on={Boolean(preview)}
            onClick={() => setPreview(preview ? null : sync(false))}
          >
            <Eye />
          </Btn>
        </div>

        {panel === "text" && (
          <div className={s.panel}>
            <p className={s.label}>Style</p>
            <div className={s.chips}>
              {STYLES.map(([v, l]) => (
                <Btn
                  key={v}
                  wide
                  label={l}
                  on={active.block === v}
                  onClick={() => cmd("formatBlock", v)}
                >
                  <span data-style={v}>{l}</span>
                </Btn>
              ))}
            </div>
            <p className={s.label}>Size and font</p>
            <div className={s.chips}>
              {SIZES.map(([v, l]) => (
                <Btn
                  key={v}
                  wide
                  label={`${l} size`}
                  onClick={() => cmd("fontSize", v)}
                >
                  {l}
                </Btn>
              ))}
              {FONTS.map(([v, l]) => (
                <Btn
                  key={v}
                  wide
                  label={`${l} font`}
                  onClick={() => cmd("fontName", v)}
                >
                  {l}
                </Btn>
              ))}
            </div>
            <div className={s.chips}>
              <Btn
                label="Strikethrough"
                on={active.s}
                onClick={() => cmd("strikeThrough")}
              >
                <Strikethrough />
              </Btn>
              <Btn
                label="Superscript"
                on={active.sup}
                onClick={() => cmd("superscript")}
              >
                <Superscript />
              </Btn>
              <Btn
                label="Subscript"
                on={active.sub}
                onClick={() => cmd("subscript")}
              >
                <Subscript />
              </Btn>
              <Btn
                label="Code"
                onClick={() =>
                  run(() => {
                    const t = document.getSelection()?.toString();
                    if (t)
                      exec(
                        "insertHTML",
                        `<code>${t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)}</code>`,
                      );
                  })
                }
              >
                <Code />
              </Btn>
              <Btn
                label="Clear formatting"
                onClick={() =>
                  run(() => {
                    exec("removeFormat");
                    exec("unlink");
                  })
                }
              >
                <Eraser />
              </Btn>
            </div>
            <p className={s.label}>
              <Baseline aria-hidden /> Text color
            </p>
            <div className={s.swatches}>
              <button
                type="button"
                aria-label="Default color"
                className={s.swNone}
                onPointerDown={hold}
                onClick={() => cmd("foreColor", "#000000")}
              >
                <X />
              </button>
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  className={s.sw}
                  style={{ background: c }}
                  onPointerDown={hold}
                  onClick={() => cmd("foreColor", c)}
                />
              ))}
              <label className={s.custom} aria-label="Any color">
                <input
                  type="color"
                  onChange={(e) => cmd("foreColor", e.target.value)}
                />
              </label>
            </div>
            <p className={s.label}>
              <Highlighter aria-hidden /> Highlight
            </p>
            <div className={s.swatches}>
              <button
                type="button"
                aria-label="No highlight"
                className={s.swNone}
                onPointerDown={hold}
                onClick={() => cmd("hiliteColor", "transparent")}
              >
                <X />
              </button>
              {HIGHLIGHTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Highlight ${c}`}
                  className={s.sw}
                  style={{ background: c }}
                  onPointerDown={hold}
                  onClick={() => cmd("hiliteColor", c)}
                />
              ))}
              <label className={s.custom} aria-label="Any highlight">
                <input
                  type="color"
                  onChange={(e) => cmd("hiliteColor", e.target.value)}
                />
              </label>
            </div>
          </div>
        )}

        {panel === "para" && (
          <div className={s.panel}>
            <div className={s.chips}>
              <Btn
                label="Align left"
                on={active.align === "left"}
                onClick={() => cmd("justifyLeft")}
              >
                <AlignLeft />
              </Btn>
              <Btn
                label="Center"
                on={active.align === "center"}
                onClick={() => cmd("justifyCenter")}
              >
                <AlignCenter />
              </Btn>
              <Btn
                label="Align right"
                on={active.align === "right"}
                onClick={() => cmd("justifyRight")}
              >
                <AlignRight />
              </Btn>
              <Btn
                label="Justify"
                on={active.align === "justify"}
                onClick={() => cmd("justifyFull")}
              >
                <AlignJustify />
              </Btn>
              <Btn label="Decrease indent" onClick={() => indent(-1)}>
                <IndentDecrease />
              </Btn>
              <Btn label="Increase indent" onClick={() => indent(1)}>
                <IndentIncrease />
              </Btn>
            </div>
            <div className={s.chips}>
              <Btn
                label="Bulleted list"
                on={active.list === "ul"}
                onClick={() => setList("ul")}
              >
                <List />
              </Btn>
              <Btn
                label="Numbered list"
                on={active.list === "ol"}
                onClick={() => setList("ol")}
              >
                <ListOrdered />
              </Btn>
              <Btn
                label="Checklist"
                on={active.list === "check"}
                onClick={() => setList("check")}
              >
                <ListChecks />
              </Btn>
              <Btn
                label="Quote"
                on={active.block === "blockquote"}
                onClick={() =>
                  cmd(
                    "formatBlock",
                    active.block === "blockquote" ? "p" : "blockquote",
                  )
                }
              >
                <Quote />
              </Btn>
            </div>
            <p className={s.label}>Callout box</p>
            <div className={s.chips}>
              {(Object.keys(TONE_LABEL) as Tone[]).map((t) => (
                <Btn
                  key={t}
                  wide
                  label={`${TONE_LABEL[t]} callout`}
                  on={active.block === `aside:${t}`}
                  onClick={() => callout(t)}
                >
                  <span className={s.tone} data-tone={t} />
                  {TONE_LABEL[t]}
                </Btn>
              ))}
              {active.block.startsWith("aside") && (
                <Btn wide label="Remove callout" onClick={() => callout(null)}>
                  Plain
                </Btn>
              )}
            </div>
          </div>
        )}

        {panel === "insert" && (
          <div className={s.panel}>
            <div className={s.chips}>
              <Btn wide label="Image" onClick={pickImage}>
                <ImagePlus /> Image
              </Btn>
              <Btn wide label="Link" onClick={() => setAsk("link")}>
                <Link2 /> Link
              </Btn>
              {active.link && (
                <Btn wide label="Remove link" onClick={() => cmd("unlink")}>
                  <Unlink /> Unlink
                </Btn>
              )}
              <Btn wide label="YouTube video" onClick={() => setAsk("video")}>
                <Youtube /> Video
              </Btn>
              <Btn
                wide
                label="Divider"
                onClick={() => insert('<hr contenteditable="false">')}
              >
                <Minus /> Divider
              </Btn>
              <Btn
                wide
                label="Today's date"
                onClick={() =>
                  run(() =>
                    exec(
                      "insertText",
                      new Date().toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      }),
                    ),
                  )
                }
              >
                <CalendarDays /> Date
              </Btn>
            </div>
            <p className={s.label}>
              <Table2 aria-hidden /> Table
            </p>
            <div className={s.chips}>
              {[
                [2, 2],
                [3, 2],
                [3, 3],
                [4, 3],
                [5, 4],
              ].map(([r, c]) => (
                <Btn
                  key={`${r}${c}`}
                  wide
                  label={`${c} by ${r} table`}
                  onClick={() => table(r, c)}
                >
                  {c} × {r}
                </Btn>
              ))}
            </div>
          </div>
        )}

        {ask && (
          <div className={s.ask}>
            <input
              autoFocus
              value={askVal}
              onChange={(e) => setAskVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitAsk();
                }
              }}
              inputMode="url"
              placeholder={
                ask === "link" ? "https://… or /page" : "YouTube link"
              }
              aria-label={ask === "link" ? "Link address" : "YouTube link"}
            />
            <button type="button" onClick={submitAsk}>
              Add
            </button>
            <button
              type="button"
              aria-label="Cancel"
              onClick={() => setAsk(null)}
            >
              <X />
            </button>
          </div>
        )}

        {active.table && (
          <div className={s.context}>
            <span>Table</span>
            <Btn wide label="Add row" onClick={() => tableEdit("row")}>
              + Row
            </Btn>
            <Btn wide label="Add column" onClick={() => tableEdit("col")}>
              + Column
            </Btn>
            <Btn wide label="Remove row" onClick={() => tableEdit("delRow")}>
              − Row
            </Btn>
            <Btn wide label="Remove column" onClick={() => tableEdit("delCol")}>
              − Column
            </Btn>
            <Btn label="Delete table" onClick={() => tableEdit("del")}>
              <Trash2 />
            </Btn>
          </div>
        )}

        {fig && (
          <div className={s.context}>
            <span>{fig.video ? "Video" : "Image"}</span>
            {!fig.video &&
              (Object.keys(IMG_LABEL) as ImgSize[]).map((z) => (
                <button
                  key={z}
                  type="button"
                  aria-pressed={fig.size === z}
                  onPointerDown={hold}
                  data-size={z}
                  onClick={figSize}
                  className={s.wide}
                >
                  {IMG_LABEL[z]}
                </button>
              ))}
            <Btn
              label="Remove"
              onClick={() => {
                figEl.current?.remove();
                figEl.current = null;
                setFig(null);
                changed();
              }}
            >
              <Trash2 />
            </Btn>
          </div>
        )}
      </div>

      {preview ? (
        <div className={s.preview}>
          <RichBody doc={preview} />
        </div>
      ) : null}
      <div
        ref={root}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        aria-label="Post"
        data-ph="Write the post…"
        spellCheck
        className={`${richStyles.rich} ${s.area}`}
        hidden={Boolean(preview)}
        onInput={onInput}
        onPaste={onPaste}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onBlur={() => sync()}
        onDrop={(e) => {
          const f = Array.from(e.dataTransfer.files).find((x) =>
            x.type.startsWith("image/"),
          );
          if (f) {
            e.preventDefault();
            addImage(f);
          }
        }}
      />
      <p className={s.count}>
        {words} {words === 1 ? "word" : "words"} ·{" "}
        {Math.max(1, Math.round(words / 220))} min read · Tip: type # for a
        title, - for bullets, [] for a checklist
      </p>
    </div>
  );
}

const hold = (e: PointerEvent) => e.preventDefault();

/** A toolbar button that keeps the caret in the post (pointer down doesn't steal focus). */
function Btn({
  label,
  on,
  onClick,
  children,
  wide,
}: {
  label: string;
  on?: boolean;
  onClick: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={on}
      onPointerDown={hold}
      onClick={onClick}
      className={wide ? s.wide : s.btn}
    >
      {children}
    </button>
  );
}

/** What the toolbar should show as active at the caret. */
function readActive(root: HTMLElement): Active {
  const sel = document.getSelection();
  const n = sel?.anchorNode;
  const e = n instanceof Element ? n : n?.parentElement;
  if (!e || !root.contains(e)) return NONE;
  let blk: Element | null = e;
  while (blk && blk.parentElement !== root) blk = blk.parentElement;
  const tag = blk?.tagName.toLowerCase() ?? "p";
  const list = e.closest("ul[data-check]")
    ? "check"
    : e.closest("ol")
      ? "ol"
      : e.closest("ul")
        ? "ul"
        : null;
  const q = (c: string) => {
    try {
      return document.queryCommandState(c);
    } catch {
      return false;
    }
  };
  const align = (blk as HTMLElement | null)?.style.textAlign || "left";
  return {
    b: q("bold"),
    i: q("italic"),
    u: q("underline"),
    s: q("strikeThrough"),
    sup: q("superscript"),
    sub: q("subscript"),
    block:
      tag === "aside"
        ? `aside:${(blk as HTMLElement).dataset.tone}`
        : ["h1", "h2", "h3", "blockquote"].includes(tag)
          ? tag
          : "p",
    list,
    align,
    table: Boolean(e.closest("td,th")),
    link: Boolean(e.closest("a")),
  };
}

const LIFT = new Set([
  "UL",
  "OL",
  "TABLE",
  "FIGURE",
  "HR",
  "ASIDE",
  "BLOCKQUOTE",
  "P",
  "H1",
  "H2",
  "H3",
]);

/**
 * Browsers sometimes build a list, table or figure inside a paragraph. Lifts such blocks
 * to the top level (text around them stays in paragraphs of the same kind) and keeps the
 * caret where it was.
 */
function normalize(root: HTMLElement | null) {
  if (!root) return;
  const sel = document.getSelection();
  const at = sel?.rangeCount
    ? { node: sel.anchorNode, off: sel.anchorOffset }
    : null;
  let moved = false;
  for (const el of Array.from(root.children) as HTMLElement[]) {
    if (
      !["P", "H1", "H2", "H3", "BLOCKQUOTE", "ASIDE", "DIV"].includes(
        el.tagName,
      )
    )
      continue;
    if (el.dataset.table !== undefined) continue;
    const blocks = Array.from(el.children).filter(
      (c) =>
        LIFT.has(c.tagName) || (c as HTMLElement).dataset.table !== undefined,
    );
    if (!blocks.length) continue;
    moved = true;
    const out: Node[] = [];
    let run: HTMLElement | null = null;
    for (const n of Array.from(el.childNodes)) {
      const isBlock = blocks.includes(n as Element);
      if (isBlock) {
        run = null;
        out.push(n);
      } else {
        if (!run) {
          run = el.cloneNode(false) as HTMLElement;
          if (run.tagName === "DIV") run = document.createElement("p");
          out.push(run);
        }
        run.appendChild(n);
      }
    }
    el.replaceWith(
      ...out.filter(
        (n) =>
          !(
            n instanceof HTMLElement &&
            LIFT.has(n.tagName) &&
            n.tagName === "P" &&
            !n.textContent &&
            !n.querySelector("br,img")
          ),
      ),
    );
  }
  if (moved && at?.node?.isConnected && sel) {
    const r = document.createRange();
    r.setStart(
      at.node,
      Math.min(
        at.off,
        at.node.nodeType === 3
          ? (at.node.textContent?.length ?? 0)
          : at.node.childNodes.length,
      ),
    );
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }
}

/** "Default color" is applied as black and then removed, so text returns to the theme color. */
function tidyFonts(root: HTMLElement | null) {
  root
    ?.querySelectorAll('font[color="#000000"]')
    .forEach((f) => f.removeAttribute("color"));
  root
    ?.querySelectorAll('font[face="default"]')
    .forEach((f) => f.removeAttribute("face"));
}
