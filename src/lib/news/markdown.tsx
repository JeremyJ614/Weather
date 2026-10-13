import type { ReactNode } from "react";

/**
 * A small, safe Markdown subset for news posts. It builds React elements (never HTML strings),
 * so nothing a post contains can run as code. Links must be http(s); images must come from
 * our own news bucket.
 *   # / ## / ###  headings      - item / 1. item  lists      > quote
 *   **bold**  *italic*  [text](https://…)  ![alt](image url)
 */
export type Block =
  | { t: "h"; level: 1 | 2 | 3; text: string }
  | { t: "p"; text: string }
  | { t: "quote"; text: string }
  | { t: "ul" | "ol"; items: string[] }
  | { t: "img"; alt: string; src: string };

const IMG = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;

export function parseBlocks(src: string): Block[] {
  const out: Block[] = [];
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ t: "p", text: para.join(" ") });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^(#{1,3})\s+(.+)$/.exec(line);
    const img = IMG.exec(line);
    if (h) {
      flush();
      out.push({ t: "h", level: h[1].length as 1 | 2 | 3, text: h[2] });
    } else if (img) {
      flush();
      out.push({ t: "img", alt: img[1], src: img[2] });
    } else if (line.startsWith("> ")) {
      flush();
      out.push({ t: "quote", text: line.slice(2) });
    } else if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      flush();
      const kind = /^\d+\./.test(line) ? "ol" : "ul";
      const re = kind === "ol" ? /^\d+\.\s+(.*)$/ : /^[-*]\s+(.*)$/;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i].trim())) {
        items.push(re.exec(lines[i].trim())![1]);
        i++;
      }
      i--;
      out.push({ t: kind, items });
    } else para.push(line);
  }
  flush();
  return out;
}

export function safeHref(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

export function safeImage(
  url: string,
  base: string | undefined,
): string | null {
  if (!base) return null;
  return url.startsWith(`${base}/storage/v1/object/public/news/`) ? url : null;
}

/** Inline: **bold**, *italic*, [text](url). */
export function inline(text: string, key = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[1] !== undefined)
      out.push(<strong key={k}>{inline(m[1], k)}</strong>);
    else if (m[2] !== undefined) out.push(<em key={k}>{inline(m[2], k)}</em>);
    else {
      const href = safeHref(m[4]);
      out.push(
        href ? (
          <a
            key={k}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {m[3]}
          </a>
        ) : (
          m[3]
        ),
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function NewsBody({ source }: { source: string }) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return (
    <div className="news-body grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 leading-relaxed [overflow-wrap:anywhere]">
      {parseBlocks(source).map((b, i) => {
        const k = `b${i}`;
        switch (b.t) {
          case "h": {
            const H = (["h2", "h3", "h4"] as const)[b.level - 1];
            return (
              <H key={k} className="display text-accent">
                {inline(b.text, k)}
              </H>
            );
          }
          case "quote":
            return (
              <blockquote
                key={k}
                className="border-l-2 border-accent pl-3 text-muted"
              >
                {inline(b.text, k)}
              </blockquote>
            );
          case "ul":
          case "ol": {
            const L = b.t;
            return (
              <L
                key={k}
                className={`${L === "ul" ? "list-disc" : "list-decimal"} pl-5`}
              >
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it, `${k}-${j}`)}</li>
                ))}
              </L>
            );
          }
          case "img": {
            const src = safeImage(b.src, base);
            return src ? (
              // eslint-disable-next-line @next/next/no-img-element -- already resized WebP from our bucket
              <img
                key={k}
                src={src}
                alt={b.alt}
                loading="lazy"
                className="mx-auto block h-auto max-h-[75vh] w-auto max-w-full rounded-xl border border-line object-contain"
              />
            ) : null;
          }
          default:
            return <p key={k}>{inline(b.text, k)}</p>;
        }
      })}
    </div>
  );
}
