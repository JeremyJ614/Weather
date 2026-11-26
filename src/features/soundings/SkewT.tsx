"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { Analysis, Parcel } from "@/lib/soundings/thermo";
import {
  barbPath,
  PRESS,
  readAt,
  skewGrid,
  skewPaths,
  SK_H as H,
  SK_W as W,
  skP,
  skX,
  skY,
} from "./geom";
import s from "./SkewT.module.css";

const f = (c: number) => Math.round((c * 9) / 5 + 32);
const STEP = [
  1000, 975, 950, 925, 900, 875, 850, 825, 800, 775, 750, 725, 700, 650, 600,
  550, 500, 450, 400, 350, 300, 250, 200, 150, 100,
];

/**
 * Skew-T log-P diagram with the chosen parcel, CAPE shaded red and the cap (CIN) blue, and
 * wind barbs. Tap or click anywhere (owner's list #41) for the air at that height: pressure,
 * height, temperature, dew point, humidity, the parcel's temperature and buoyancy, the wind
 * and the lapse rate, and which layer it is in; arrows step up and down.
 */
export function SkewT({
  a,
  parcel,
  c,
}: {
  a: Analysis;
  parcel: Parcel;
  c: (k: string) => string;
}) {
  const g = skewGrid();
  const d = useMemo(() => skewPaths(a, parcel), [a, parcel]);
  const [p, setP] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const L = a.levels;
  const r = p == null ? null : readAt(a, parcel, p);
  const pick = (clientY: number) => {
    const el = svg.current;
    const m = el?.getScreenCTM();
    if (!el || !m) return;
    const pt = new DOMPoint(0, clientY).matrixTransform(m.inverse());
    const yy = Math.max(0, Math.min(H, pt.y));
    setP(skP(yy));
  };
  const step = (dir: 1 | -1) => {
    const cur = p ?? L[0][0];
    const top = L[L.length - 1][0];
    const list = [L[0][0], ...STEP.filter((x) => x < L[0][0] && x >= top)];
    const at = list.reduce(
      (b, x, i) => (Math.abs(x - cur) < Math.abs(list[b] - cur) ? i : b),
      0,
    );
    setP(list[Math.max(0, Math.min(list.length - 1, at + dir))]);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "Escape") setP(null);
  };
  const bt = c("storm");
  const ry = r ? skY(r.p) : 0;
  return (
    <div className={s.wrap}>
      <svg
        ref={svg}
        viewBox={`-30 -6 ${W + 70} ${H + 22}`}
        className={s.svg}
        role="img"
        aria-label="Skew-T log-P diagram. Tap any height for details; arrow keys step up and down."
        tabIndex={0}
        onPointerDown={(e) => pick(e.clientY)}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.buttons) pick(e.clientY);
        }}
        onKeyDown={key}
      >
        <defs>
          <clipPath id="skewt-clip">
            <rect x={0} y={0} width={W} height={H} />
          </clipPath>
        </defs>
        <rect
          x={0}
          y={0}
          width={W}
          height={H}
          fill="none"
          stroke="var(--line)"
        />
        <g clipPath="url(#skewt-clip)" fill="none">
          {g.dry.map((dd, i) => (
            <path
              key={i}
              d={dd}
              stroke="#a16207"
              strokeOpacity={0.28}
              strokeWidth={0.7}
            />
          ))}
          {g.moist.map((dd, i) => (
            <path
              key={i}
              d={dd}
              stroke="#0e7490"
              strokeOpacity={0.4}
              strokeWidth={0.7}
              strokeDasharray="3 3"
            />
          ))}
          {g.iso.map((l) => (
            <path
              key={l.t}
              d={l.d}
              stroke={l.t === 0 ? "#60a5fa" : "var(--line)"}
              strokeOpacity={l.t === 0 ? 0.6 : 0.7}
              strokeWidth={l.t === 0 ? 1 : 0.6}
            />
          ))}
          {PRESS.map((pp) => (
            <line
              key={pp}
              x1={0}
              x2={W}
              y1={skY(pp)}
              y2={skY(pp)}
              stroke="var(--line)"
              strokeWidth={0.7}
            />
          ))}
          {d.cin && (
            <path
              d={d.cin}
              fill={c("cin")}
              fillOpacity={0.32}
              stroke={c("cin")}
              strokeOpacity={0.55}
              strokeWidth={0.6}
            />
          )}
          {d.cape && (
            <path
              d={d.cape}
              fill={c("cape")}
              fillOpacity={0.3}
              stroke={c("cape")}
              strokeOpacity={0.55}
              strokeWidth={0.6}
            />
          )}
          <path
            d={d.par}
            stroke={c("parcel")}
            strokeWidth={1.4}
            strokeDasharray="5 3"
          />
          <path
            d={d.dew}
            stroke={c("dew")}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          <path
            d={d.temp}
            stroke={c("temp")}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          {r && (
            <g className={s.cross}>
              <line x1={0} x2={W} y1={ry} y2={ry} />
              {r.td != null && (
                <circle cx={skX(r.td, r.p)} cy={ry} r={4.5} fill={c("dew")} />
              )}
              {r.tp != null && (
                <circle
                  cx={skX(r.tp, r.p)}
                  cy={ry}
                  r={3.5}
                  fill={c("parcel")}
                />
              )}
              <circle cx={skX(r.t, r.p)} cy={ry} r={4.5} fill={c("temp")} />
            </g>
          )}
        </g>
        {d.capeAt && parcel.cape > 50 && (
          <text
            x={d.capeAt[0]}
            y={d.capeAt[1]}
            textAnchor="middle"
            fontSize={10}
            fontWeight={800}
            fill={c("cape")}
            className={s.tag}
          >
            CAPE {parcel.cape}
          </text>
        )}
        {d.cinAt && parcel.cin < -5 && (
          <text
            x={d.cinAt[0] - 6}
            y={d.cinAt[1] - 4}
            textAnchor="end"
            fontSize={10}
            fontWeight={800}
            fill={c("cin")}
            className={s.tag}
          >
            CIN {parcel.cin}
          </text>
        )}
        {PRESS.map((pp) => (
          <text
            key={pp}
            x={-4}
            y={skY(pp) + 3}
            textAnchor="end"
            fontSize={9}
            fill="var(--muted)"
          >
            {pp}
          </text>
        ))}
        {[-30, -20, -10, 0, 10, 20, 30, 40].map((t) => (
          <text
            key={t}
            x={skX(t, 1050)}
            y={H + 12}
            textAnchor="middle"
            fontSize={9}
            fill="var(--muted)"
          >
            {t}°
          </text>
        ))}
        {d.marks.map(([k, yy]) => (
          <g key={k}>
            <line
              x1={W - 34}
              x2={W - 4}
              y1={yy}
              y2={yy}
              stroke={c("parcel")}
              strokeWidth={1}
            />
            <text
              x={W - 36}
              y={yy + 3}
              textAnchor="end"
              fontSize={9}
              fontWeight={700}
              fill={c("parcel")}
            >
              {k}
            </text>
          </g>
        ))}
        <line x1={W + 22} x2={W + 22} y1={0} y2={H} stroke="var(--line)" />
        {d.barbs.map((b) => (
          <path
            key={b.y}
            d={barbPath(b.kt)}
            transform={`translate(${W + 22} ${b.y}) rotate(${b.dir})`}
            stroke={bt}
            fill={b.kt < 2.5 ? "none" : bt}
            strokeWidth={1.1}
          />
        ))}
      </svg>
      {r ? (
        <div className={s.read} role="status" aria-live="polite">
          <div className={s.top}>
            <b>
              {r.p} mb · {r.z.toLocaleString("en-US")} m (
              {Math.round(r.z * 3.281).toLocaleString("en-US")} ft)
            </b>
            <span className={s.btns}>
              <button
                type="button"
                aria-label="Up a level"
                onClick={() => step(1)}
              >
                <ChevronUp aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Down a level"
                onClick={() => step(-1)}
              >
                <ChevronDown aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Close the details"
                onClick={() => setP(null)}
              >
                <X aria-hidden />
              </button>
            </span>
          </div>
          <p
            className={s.zone}
            data-k={r.inCape ? "cape" : r.inCin ? "cin" : undefined}
            style={{
              ["--z" as string]: r.inCape
                ? c("cape")
                : r.inCin
                  ? c("cin")
                  : "var(--muted)",
            }}
          >
            {r.zone}
          </p>
          <dl>
            <div>
              <dt>Temperature</dt>
              <dd style={{ color: c("temp") }}>
                {r.t.toFixed(1)}°C · {f(r.t)}°F
              </dd>
            </div>
            <div>
              <dt>Dew point</dt>
              <dd style={{ color: c("dew") }}>
                {r.td == null ? "–" : `${r.td.toFixed(1)}°C · ${f(r.td)}°F`}
              </dd>
            </div>
            <div>
              <dt>Humidity</dt>
              <dd>{r.rh == null ? "–" : `${r.rh}%`}</dd>
            </div>
            <div>
              <dt>Parcel</dt>
              <dd>
                {r.tp == null
                  ? "–"
                  : `${r.tp.toFixed(1)}°C (${r.buoy! >= 0 ? "+" : ""}${r.buoy!.toFixed(1)}°)`}
              </dd>
            </div>
            <div>
              <dt>Wind</dt>
              <dd>
                {r.kt == null
                  ? "–"
                  : r.kt < 1
                    ? "Calm"
                    : `${r.dir}° at ${r.kt} kt`}
              </dd>
            </div>
            <div>
              <dt>Lapse rate</dt>
              <dd>{r.lapse == null ? "–" : `${r.lapse} °C/km`}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className={s.hint}>
          Tap anywhere on the chart for the air at that height. Red is CAPE,
          blue is the cap (CIN).
        </p>
      )}
    </div>
  );
}
