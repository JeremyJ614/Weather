import type { CSSProperties, ReactNode } from "react";
import s from "./Dash.module.css";

/** Shared pieces for the admin dashboards (owner's follow-up #5). Server-safe, no JavaScript. */

export const TONE = {
  good: "#4ade80",
  warn: "#fbbf24",
  bad: "#f87171",
  info: "#4cc9f0",
  violet: "#a78bfa",
  pink: "#ff5f8f",
} as const;
const tone = (c?: string) =>
  (c ? { ["--tone" as string]: c } : undefined) as CSSProperties | undefined;

export function Page({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className={s.page}>
      <div className={s.head}>
        <h1>{title}</h1>
        {lead && <p>{lead}</p>}
      </div>
      {children}
    </main>
  );
}

/** The one-line verdict at the top: green, amber or red, with a pulse. */
export function Banner({
  color,
  title,
  detail,
}: {
  color: string;
  title: string;
  detail?: ReactNode;
}) {
  return (
    <div className={s.banner} style={tone(color)} role="status">
      <i className={s.pulse} aria-hidden />
      <div>
        <b>{title}</b>
        {detail && <small>{detail}</small>}
      </div>
    </div>
  );
}

export function Tiles({ children }: { children: ReactNode }) {
  return <div className={s.tiles}>{children}</div>;
}

export function Tile({
  label,
  value,
  sub,
  color,
  hero,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  color?: string;
  hero?: boolean;
}) {
  return (
    <div className={`${s.tile} ${hero ? s.hero : ""}`} style={tone(color)}>
      <span>{label}</span>
      <b>{value}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}

export function Card({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={s.card}>
      <header>
        <h2>{title}</h2>
        {meta && <small>{meta}</small>}
      </header>
      {children}
    </section>
  );
}

/** A filled bar, 0–1. */
export function Meter({ f, color }: { f: number; color?: string }) {
  return (
    <div
      className={s.meter}
      style={{
        ...tone(color),
        ["--f" as string]: Math.max(0, Math.min(1, f)),
      }}
      role="img"
      aria-label={`${Math.round(f * 100)}%`}
    >
      <i />
    </div>
  );
}

/** Ranked bars: label, value text and a bar scaled to the largest. */
export function Bars({
  rows,
}: {
  rows: { label: ReactNode; value: number; text: ReactNode; color?: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className={s.bars}>
      {rows.map((r, i) => (
        <div key={i} className={s.bar}>
          <div>
            <span>{r.label}</span>
            <span>{r.text}</span>
          </div>
          <Meter f={r.value / max} color={r.color} />
        </div>
      ))}
    </div>
  );
}

/** One bar split into colored parts. */
export function Stack({
  parts,
}: {
  parts: { value: number; color: string; label: string }[];
}) {
  return (
    <div
      className={s.stack}
      role="img"
      aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}
    >
      {parts.map((p) =>
        p.value ? (
          <i
            key={p.label}
            style={{ flexGrow: p.value, background: p.color }}
            title={`${p.label}: ${p.value}`}
          />
        ) : null,
      )}
    </div>
  );
}

export function Keys({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className={s.keys}>
      {items.map((k) => (
        <span key={k.label}>
          <i style={{ background: k.color }} />
          {k.label}
        </span>
      ))}
    </div>
  );
}

/** A status row: colored dot, name, detail. */
export function Row({
  color,
  name,
  detail,
}: {
  color: string;
  name: ReactNode;
  detail: ReactNode;
}) {
  return (
    <div className={s.row} style={tone(color)}>
      <i className={s.dot} aria-hidden />
      <span>{name}</span>
      <span>{detail}</span>
    </div>
  );
}

export function Rows({ children }: { children: ReactNode }) {
  return <div className={s.rows}>{children}</div>;
}

export function Chips({ children }: { children: ReactNode }) {
  return <div className={s.chips}>{children}</div>;
}

export function Split({ children }: { children: ReactNode }) {
  return <div className={s.split}>{children}</div>;
}

/** A ring of shares with a number in the middle. */
export function Donut({
  parts,
  center,
  caption,
}: {
  parts: { value: number; color: string; label: string }[];
  center: string;
  caption: string;
}) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const R = 52;
  const C = 2 * Math.PI * R;
  // Where each slice starts along the ring.
  const starts = parts.map((_, i) =>
    parts.slice(0, i).reduce((a, p) => a + (p.value / total) * C, 0),
  );
  return (
    <svg
      viewBox="0 0 150 150"
      className={s.donut}
      role="img"
      aria-label={caption}
    >
      <circle
        cx="75"
        cy="75"
        r={R}
        fill="none"
        stroke="rgb(255 255 255 / 0.06)"
        strokeWidth="16"
      />
      {parts.map((p) => {
        const len = (p.value / total) * C;
        const el = (
          <circle
            key={p.label}
            cx="75"
            cy="75"
            r={R}
            fill="none"
            stroke={p.color}
            strokeWidth="16"
            strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`}
            strokeDashoffset={-starts[parts.indexOf(p)]}
            transform="rotate(-90 75 75)"
          />
        );
        return el;
      })}
      <text x="75" y="76">
        {center}
      </text>
      <text x="75" y="92">
        {caption.toUpperCase()}
      </text>
    </svg>
  );
}

/** A smooth area chart of a series, with its peak marked. */
export function Area({
  values,
  from,
  to,
  label,
  color = TONE.info,
}: {
  values: number[];
  from: string;
  to: string;
  label: string;
  color?: string;
}) {
  const W = 300;
  const H = 100;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [
    (i / Math.max(1, values.length - 1)) * W,
    H - 6 - (v / max) * (H - 16),
  ]);
  const line = pts
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join("");
  const peak = values.indexOf(max);
  const id = `g${label.replace(/\W/g, "")}`;
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className={s.area}
        role="img"
        aria-label={label}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.45" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {pts.length > 1 && (
          <>
            <path d={`${line}L${W} ${H}L0 ${H}Z`} fill={`url(#${id})`} />
            <path
              d={line}
              fill="none"
              stroke={color}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {peak >= 0 && (
              <circle
                cx={pts[peak][0]}
                cy={pts[peak][1]}
                r="3.5"
                fill={color}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </>
        )}
      </svg>
      <div className={s.axis}>
        <span>{from}</span>
        <span>peak {max.toLocaleString("en-US")}</span>
        <span>{to}</span>
      </div>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className={s.note}>{children}</p>;
}
