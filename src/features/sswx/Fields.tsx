"use client";

import { useEffect, useRef, useState } from "react";
import type { Answer, Field, Position, Social } from "@/lib/sswx/types";
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
      return null;
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
                {x.name.slice(0, 2)}
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
