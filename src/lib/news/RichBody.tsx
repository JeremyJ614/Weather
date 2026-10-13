import type { CSSProperties, ReactNode } from "react";
import type { Block, Doc, Run } from "./doc";
import s from "./Rich.module.css";

/** One run of text with its marks, as nested React elements (no HTML strings). */
function RunView({ r }: { r: Run }) {
  let n: ReactNode = r.x.includes("\n")
    ? r.x
        .split("\n")
        .flatMap((part, i) => (i ? [<br key={i} />, part] : [part]))
    : r.x;
  if (r.code) n = <code>{n}</code>;
  if (r.sup) n = <sup>{n}</sup>;
  else if (r.sub) n = <sub>{n}</sub>;
  if (r.s) n = <s>{n}</s>;
  if (r.u) n = <u>{n}</u>;
  if (r.i) n = <em>{n}</em>;
  if (r.b) n = <strong>{n}</strong>;
  if (r.color || r.hl || r.size || r.font) {
    const style: CSSProperties = {};
    if (r.color) style.color = r.color;
    if (r.hl) style.backgroundColor = r.hl;
    n = (
      <span style={style} data-size={r.size} data-font={r.font}>
        {n}
      </span>
    );
  }
  if (r.href)
    n = (
      <a
        href={r.href}
        {...(r.href.startsWith("/")
          ? {}
          : { target: "_blank", rel: "noopener noreferrer nofollow" })}
      >
        {n}
      </a>
    );
  return n;
}

const Runs = ({ c }: { c: Run[] }) =>
  c.length ? c.map((r, i) => <RunView key={i} r={r} />) : <br />;

function BlockView({ b }: { b: Block }) {
  switch (b.t) {
    case "p":
    case "h1":
    case "h2":
    case "h3":
    case "quote": {
      const style: CSSProperties = {};
      if (b.align) style.textAlign = b.align;
      if (b.ind) style.paddingInlineStart = `${b.ind * 1.5}em`;
      const Tag = (
        { p: "p", h1: "h2", h2: "h3", h3: "h4", quote: "blockquote" } as const
      )[b.t];
      return (
        <Tag data-l={b.t} style={style}>
          <Runs c={b.c} />
        </Tag>
      );
    }
    case "callout":
      return (
        <aside data-tone={b.tone}>
          <Runs c={b.c} />
        </aside>
      );
    case "ul":
    case "ol":
    case "check": {
      const L = b.t === "ol" ? "ol" : "ul";
      return (
        <L data-check={b.t === "check" ? "" : undefined}>
          {b.items.map((it, i) => (
            <li
              key={i}
              data-lvl={it.lvl}
              data-done={b.t === "check" && it.done ? "" : undefined}
            >
              <Runs c={it.c} />
            </li>
          ))}
        </L>
      );
    }
    case "img":
      return (
        <figure data-size={b.size ?? "full"}>
          {/* eslint-disable-next-line @next/next/no-img-element -- resized WebP from our bucket */}
          <img src={b.src} alt={b.alt} loading="lazy" />
          {b.cap && <figcaption>{b.cap}</figcaption>}
        </figure>
      );
    case "hr":
      return <hr />;
    case "table":
      return (
        <div data-table="">
          <table>
            <tbody>
              {b.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => {
                    const C = b.head && i === 0 ? "th" : "td";
                    return (
                      <C key={j}>
                        <Runs c={cell} />
                      </C>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "video":
      return (
        <figure data-video="">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${b.id}`}
            title="YouTube video"
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </figure>
      );
  }
}

/** A rich SSWX News post. The editor uses the same `.rich` styles, so what you write is what readers see. */
export function RichBody({ doc }: { doc: Doc }) {
  return (
    <div className={s.rich}>
      {doc.blocks.map((b, i) => (
        <BlockView key={i} b={b} />
      ))}
    </div>
  );
}

export { s as richStyles };
