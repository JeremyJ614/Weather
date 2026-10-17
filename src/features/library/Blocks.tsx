import Image from "next/image";
import type { ReactNode } from "react";
import type { Block } from "@/lib/library/data";
import s from "./Library.module.css";

/**
 * The library's inline markup (**bold**, *italic*, [text](https://…)) as React nodes.
 * Built node by node, never as HTML, so nothing in an article can inject markup; links
 * must be http(s).
 */
export function Inline({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] != null) out.push(<strong key={k++}>{m[1]}</strong>);
    else if (m[2] != null) out.push(<em key={k++}>{m[2]}</em>);
    else
      out.push(
        <a key={k++} href={m[4]} target="_blank" rel="noreferrer">
          {m[3]}
        </a>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/** An article body: the Academy's block types, drawn in this app's reading style. */
export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className={s.prose}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "rich-text":
            return (
              <p key={i}>
                <Inline text={b.props.body} />
              </p>
            );
          case "heading":
            return b.props.level <= 2 ? (
              <h2 key={i}>{b.props.text}</h2>
            ) : (
              <h3 key={i}>{b.props.text}</h3>
            );
          case "figure":
            return (
              <figure
                key={i}
                style={{ maxWidth: Math.max(240, b.props.width || 800) }}
              >
                <Image
                  src={b.props.src}
                  alt={b.props.alt}
                  width={b.props.width || 800}
                  height={b.props.height || 500}
                  sizes="(max-width: 700px) 100vw, 640px"
                  unoptimized
                  loading="lazy"
                />
                {(b.props.caption || b.props.credit) && (
                  <figcaption>
                    {b.props.caption && <Inline text={b.props.caption} />}
                    {b.props.credit && <small>{b.props.credit}</small>}
                  </figcaption>
                )}
              </figure>
            );
          case "bulleted-list":
          case "numbered-list": {
            const L = b.type === "bulleted-list" ? "ul" : "ol";
            return (
              <L key={i}>
                {b.props.items.map((x, j) => (
                  <li key={j}>
                    <Inline text={x} />
                  </li>
                ))}
              </L>
            );
          }
          case "table":
            return (
              <div key={i} className={s.tableWrap}>
                <table>
                  {b.props.caption && (
                    <caption>
                      <Inline text={b.props.caption} />
                    </caption>
                  )}
                  <thead>
                    <tr>
                      {b.props.headers.map((h, j) => (
                        <th key={j}>
                          <Inline text={h} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.props.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, n) => (
                          <td key={n}>
                            <Inline text={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "callout":
            return (
              <aside key={i} className={s.callout}>
                {b.props.title && <b>{b.props.title}</b>}
                <p>
                  <Inline text={b.props.body} />
                </p>
              </aside>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
