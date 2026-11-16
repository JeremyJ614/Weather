"use client";

import { useEffect, useRef, useState } from "react";
import {
  iconSrc,
  type Answer,
  type Field,
  type Position,
  type Social,
} from "@/lib/sswx/types";
export { missing } from "@/lib/sswx/types";
import s from "./Sswx.module.css";

export type Ctx = {
  team: { id: string; name: string }[];
  positions: (Position & { color: string })[];
  socials: Social[];
};
type Props = {
  f: Field;
  v: Answer | undefined;
  set: (v: Answer) => void;
  ctx: Ctx;
};

const SPARK = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M14.2 8.1 15 5.3l.8 2.8a4 4 0 0 0 2.7 2.7l2.8.8-2.8.8a4 4 0 0 0-2.7 2.7L15 18.8l-.8-2.8a4 4 0 0 0-2.7-2.7L8.3 12l2.8-.8a4 4 0 0 0 2.7-2.7ZM6 14.3l-.3 1a2.3 2.3 0 0 1-1.7 1.7l-1 .3 1 .3a2.3 2.3 0 0 1 1.7 1.7l.3 1 .3-1a2.3 2.3 0 0 1 1.7-1.7l1-.3-1-.3a2.3 2.3 0 0 1-1.7-1.7Z" />
  </svg>
);

const list = (v: Answer | undefined) => (Array.isArray(v) ? v : []);
const flip = (arr: string[], x: string) =>
  arr.includes(x) ? arr.filter((y) => y !== x) : [...arr, x];

export function FieldInput({ f, v, set, ctx }: Props) {
  const id = `f-${f.id}`;
  const text = (type: string, extra?: object) => (
    <span className={s.pulse}>
      <input
        id={id}
        type={type}
        value={String(v ?? "")}
        placeholder={f.placeholder}
        onChange={(e) => set(e.target.value)}
        {...extra}
      />
    </span>
  );
  switch (f.type) {
    case "section":
    case "page":
      return null;
    case "rank": {
      const opts = f.options ?? [];
      const order = list(v).length ? (list(v) as string[]) : opts;
      const mv = (i: number, d: number) => {
        const c = [...order];
        [c[i], c[i + d]] = [c[i + d], c[i]];
        set(c);
      };
      return (
        <ol className={s.rank}>
          {order.map((o, i) => (
            <li key={o} style={{ ["--i" as string]: i }}>
              <b>{i + 1}</b>
              <span>{o}</span>
              <button
                type="button"
                aria-label={`Move ${o} up`}
                disabled={!i}
                onClick={() => mv(i, -1)}
              >
                ▲
              </button>
              <button
                type="button"
                aria-label={`Move ${o} down`}
                disabled={i === order.length - 1}
                onClick={() => mv(i, 1)}
              >
                ▼
              </button>
            </li>
          ))}
        </ol>
      );
    }
    case "matrix": {
      const m = (v ?? {}) as Record<string, string>;
      return (
        <div className={s.matrix}>
          {(f.options ?? []).map((o) => (
            <div key={o} role="radiogroup" aria-label={o}>
              <span>{o}</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={m[o] === String(n)}
                  aria-label={`${o}: ${n}`}
                  data-on={Number(m[o] ?? 0) >= n ? "" : undefined}
                  onClick={() => set({ ...m, [o]: String(n) })}
                />
              ))}
            </div>
          ))}
        </div>
      );
    }
    case "emoji":
      return (
        <div className={s.emoji} role="radiogroup" aria-label={f.label}>
          {["😖", "🙁", "😐", "🙂", "🤩"].map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={v === e}
              onClick={() => set(e)}
            >
              {e}
            </button>
          ))}
        </div>
      );
    case "color":
      return (
        <div className={s.swatches} role="radiogroup" aria-label={f.label}>
          {(f.options?.length
            ? f.options
            : [
                "#ef4444",
                "#f59e0b",
                "#eab308",
                "#22c55e",
                "#06b6d4",
                "#3b82f6",
                "#8b5cf6",
                "#ec4899",
              ]
          ).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={v === c}
              aria-label={c}
              style={{ background: c }}
              onClick={() => set(c)}
            />
          ))}
          <input
            type="color"
            aria-label="Custom color"
            value={/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : "#888888"}
            onChange={(e) => set(e.target.value)}
          />
        </div>
      );
    case "tags": {
      const t = list(v) as string[];
      return (
        <div className={s.tags}>
          {t.map((x) => (
            <button
              key={x}
              type="button"
              className={s.chip}
              aria-pressed
              onClick={() => set(t.filter((y) => y !== x))}
            >
              {x} ✕
            </button>
          ))}
          <span className={s.pulse}>
            <input
              id={id}
              placeholder={f.placeholder || "Type and press Enter"}
              onKeyDown={(e) => {
                const x = e.currentTarget.value.trim();
                if (e.key === "Enter" && x) {
                  e.preventDefault();
                  if (!t.includes(x) && t.length < 20) set([...t, x]);
                  e.currentTarget.value = "";
                }
              }}
            />
          </span>
        </div>
      );
    }
    case "short":
      return text("text", { maxLength: 200 });
    case "email":
      return text("email", { autoComplete: "email" });
    case "phone":
      return text("tel", { autoComplete: "tel" });
    case "url":
      return text("url", { placeholder: f.placeholder || "https://" });
    case "date":
      return text("date");
    case "time":
      return text("time");
    case "number":
      return (
        <span className={s.pulse}>
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={f.min}
            max={f.max}
            step={f.step}
            value={v === undefined ? "" : String(v)}
            onChange={(e) =>
              set(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </span>
      );
    case "paragraph":
      return (
        <span className={s.pulse}>
          <textarea
            id={id}
            maxLength={4000}
            value={String(v ?? "")}
            placeholder={f.placeholder}
            onChange={(e) => set(e.target.value)}
          />
        </span>
      );
    case "range": {
      const min = f.min ?? 0;
      const max = f.max ?? 10;
      const val = typeof v === "number" ? v : Math.round((min + max) / 2);
      return (
        <div className={s.range}>
          <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={f.step ?? 1}
            value={val}
            onChange={(e) => set(Number(e.target.value))}
          />
          <output htmlFor={id}>{val}</output>
        </div>
      );
    }
    case "dropdown":
      return (
        <span className={s.pulse}>
          <select
            id={id}
            value={String(v ?? "")}
            onChange={(e) => set(e.target.value)}
          >
            <option value="">Choose…</option>
            {(f.options ?? []).map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </span>
      );
    case "radio":
    case "checkbox": {
      const multi = f.type === "checkbox" ? f.multi !== false : !!f.multi;
      const on = (o: string) => (multi ? list(v).includes(o) : v === o);
      return (
        <div className={s.row} role={multi ? "group" : "radiogroup"}>
          {(f.options ?? []).map((o) => (
            <button
              key={o}
              type="button"
              role={multi ? "checkbox" : "radio"}
              aria-checked={on(o)}
              className={s.chip}
              onClick={() =>
                set(multi ? flip(list(v) as string[], o) : on(o) ? "" : o)
              }
            >
              {f.type === "radio" ? (
                <span className={s.dot} />
              ) : (
                <span className={s.box}>{on(o) ? "✓" : ""}</span>
              )}
              {o}
            </button>
          ))}
        </div>
      );
    }
    case "yesno":
      return (
        <div
          className={s.toggle}
          data-v={v === true ? "yes" : v === false ? "no" : "none"}
        >
          <i aria-hidden />
          <button
            type="button"
            aria-pressed={v === true}
            onClick={() => set(true)}
          >
            Yes
          </button>
          <button
            type="button"
            aria-pressed={v === false}
            onClick={() => set(false)}
          >
            No
          </button>
        </div>
      );
    case "stars": {
      const n = typeof v === "number" ? v : 0;
      return (
        <div className={s.stars} role="radiogroup" aria-label={f.label}>
          {Array.from({ length: f.max ?? 5 }, (_, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={n === i + 1}
              aria-label={`${i + 1} star${i ? "s" : ""}`}
              data-on={i < n ? "" : undefined}
              onClick={() => set(i + 1)}
            >
              ★
            </button>
          ))}
        </div>
      );
    }
    case "terms":
      return (
        <div className={s.row} style={{ alignItems: "flex-start" }}>
          <button
            type="button"
            role="checkbox"
            aria-checked={v === true}
            aria-label={`Agree to ${f.label}`}
            className={s.chip}
            onClick={() => set(v !== true)}
          >
            <span className={s.box}>{v === true ? "✓" : ""}</span>I agree
          </button>
          <details className={s.terms} style={{ flex: 1, minWidth: 220 }}>
            <summary>{f.label}</summary>
            <p>{f.terms || "No terms text yet."}</p>
          </details>
        </div>
      );
    case "referral":
      return (
        <div className={s.row}>
          {ctx.team.map((t) => {
            const on = list(v).includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                className={s.sparkle}
                onClick={() => set(flip(list(v) as string[], t.id))}
              >
                {SPARK}
                {t.name}
              </button>
            );
          })}
        </div>
      );
    case "positions":
      return (
        <div style={{ display: "grid", gap: 8 }}>
          {ctx.positions.map((p) => {
            const on = list(v).includes(p.id);
            return (
              <details
                key={p.id}
                className={s.pos}
                data-on={on ? "" : undefined}
                style={{ ["--c" as string]: p.color }}
              >
                <summary>
                  <b>{p.name}</b>
                  <small style={{ color: p.color }}>
                    {on ? "✓ Selected" : "Open"}
                  </small>
                </summary>
                <p>{p.about || "No description yet."}</p>
                <label>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => set(flip(list(v) as string[], p.id))}
                  />
                  I want this position
                </label>
              </details>
            );
          })}
        </div>
      );
    case "social": {
      const m = (v ?? {}) as Record<string, string>;
      return (
        <div className={s.socials}>
          {ctx.socials.map((x) => (
            <label
              key={x.id}
              className={s.social}
              data-on={m[x.id] ? "" : undefined}
              style={{ ["--brand" as string]: x.color }}
            >
              <span className={s.ico} aria-hidden>
                {/* Brand marks from Simple Icons (or the owner's own image link). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={iconSrc(x)}
                  alt=""
                  width={22}
                  height={22}
                  loading="lazy"
                />
              </span>
              <span className={s.pulse}>
                <input
                  aria-label={`${x.name} username or link`}
                  placeholder={`${x.name} username or link`}
                  value={m[x.id] ?? ""}
                  onChange={(e) => set({ ...m, [x.id]: e.target.value })}
                />
              </span>
            </label>
          ))}
        </div>
      );
    }
    case "signature":
      return <Signature v={v} set={set} />;
  }
}

/** Draw with a finger or mouse, or type it and get an elegant script. Stored as an image. */
function Signature({
  v,
  set,
}: {
  v: Answer | undefined;
  set: (v: Answer) => void;
}) {
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typed, setTyped] = useState("");
  const pad = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const c = pad.current;
    if (!c || mode !== "draw") return;
    const r = c.getBoundingClientRect();
    c.width = r.width * devicePixelRatio;
    c.height = r.height * devicePixelRatio;
    const g = c.getContext("2d")!;
    g.scale(devicePixelRatio, devicePixelRatio);
    g.lineWidth = 2.4;
    g.lineCap = g.lineJoin = "round";
    g.strokeStyle = getComputedStyle(c).color || "#fff";
  }, [mode]);
  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const typedImage = async (name: string) => {
    await document.fonts.load('64px "SSWX Signature"');
    const c = document.createElement("canvas");
    c.width = 900;
    c.height = 220;
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff";
    g.font = '96px "SSWX Signature", cursive';
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(name, 450, 120, 860);
    return c.toDataURL("image/png");
  };
  return (
    <div className={s.sig}>
      <div className={s.sigTabs} role="tablist">
        {(["draw", "type"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={s.chip}
            onClick={() => {
              setMode(m);
              set("");
            }}
          >
            {m === "draw" ? "Draw it" : "Type it"}
          </button>
        ))}
        {v ? <span className={s.muted}>✓ Signed</span> : null}
      </div>
      {mode === "draw" ? (
        <>
          <canvas
            ref={pad}
            className={s.sigPad}
            aria-label="Signature pad"
            onPointerDown={(e) => {
              drawing.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              const g = e.currentTarget.getContext("2d")!;
              const [x, y] = at(e);
              g.beginPath();
              g.moveTo(x, y);
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return;
              const g = e.currentTarget.getContext("2d")!;
              const [x, y] = at(e);
              g.lineTo(x, y);
              g.stroke();
            }}
            onPointerUp={(e) => {
              drawing.current = false;
              set(e.currentTarget.toDataURL("image/png"));
            }}
          />
          <button
            type="button"
            className={s.ghost}
            onClick={() => {
              const c = pad.current;
              c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
              set("");
            }}
          >
            Clear
          </button>
        </>
      ) : (
        <>
          <span className={s.pulse}>
            <input
              placeholder="Type your full name"
              value={typed}
              onChange={async (e) => {
                const t = e.target.value;
                setTyped(t);
                set(t.trim() ? await typedImage(t.trim()) : "");
              }}
            />
          </span>
          <div className={s.sigType} aria-hidden>
            {typed || " "}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The submit button: submit-button.zip's morph (the outline shrinks to a loader that circles,
 * then draws a check as the pill turns green), then css3-3d-flip-button.zip's flip onto a green
 * "Submitted" face. `state`: "" idle, "start", "progress", "end" (check), "flip".
 */
export function SubmitButton({
  state,
  label,
  onClick,
}: {
  state: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className={s.flipWrap}>
      <div className={s.flipper} data-flip={state === "flip" ? "" : undefined}>
        <button
          type="button"
          className={s.front}
          data-s={state || undefined}
          onClick={onClick}
          disabled={!!state}
        >
          <span className={s.txt}>{label}</span>
          <svg viewBox="0 0 240 220" aria-hidden>
            <rect x="20" y="100" width="200" height="60" rx="30" />
            <path
              className={s.top}
              d="M60,100 L50,100 C33.4,100 20,113.4 20,130 L20,130 C20,146.6 33.4,160 50,160 L190,160 C206.6,160 220,146.6 220,130 L220,100 C220,-60 180,80 160,100 C140,120 100,160 100,160"
            />
            <path
              className={s.bot}
              d="M180,160 L190,160 C206.6,160 220,146.6 220,130 L220,130 C220,113.4 206.6,100 190,100 L50,100 C33.4,100 20,113.4 20,130 C20,130 20,120 20,140 C20,220 180,200 120,140 C100,120 80,100 80,100"
            />
          </svg>
        </button>
        <div className={s.back} aria-live="polite">
          {state === "flip" ? "Submitted" : ""}
          <i aria-hidden>✓</i>
        </div>
      </div>
    </div>
  );
}
