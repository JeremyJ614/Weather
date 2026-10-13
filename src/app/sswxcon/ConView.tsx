"use client";

import { useEffect, useState } from "react";
import {
  CloudLightning,
  Flame,
  Radar,
  RefreshCw,
  Snowflake,
  Tornado,
  Waves,
  Wind,
} from "lucide-react";
import type { National } from "@/lib/sswxcon/live";
import { Meter } from "./Meter";
import s from "./Con.module.css";

const ICONS: Record<string, React.ReactNode> = {
  tornado: <Tornado aria-hidden />,
  severe: <CloudLightning aria-hidden />,
  tropical: <Wind aria-hidden />,
  flood: <Waves aria-hidden />,
  winter: <Snowflake aria-hidden />,
  setup: <Radar aria-hidden />,
  fire: <Flame aria-hidden />,
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

/** The live national score; refreshes every five minutes while visible. */
export function ConView({ initial }: { initial: National }) {
  const [n, setN] = useState(initial);
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/sswxcon");
      if (r.ok) setN(await r.json());
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 5 * 60_000);
    return () => clearInterval(t);
  }, []);

  const live = n.components.filter((c) => c.score > 0);
  return (
    <div className="grid gap-5">
      <section className={s.hero}>
        <Meter key={n.at} total={n.total} />
        <p className={s.drivers}>{n.drivers}</p>
        <div className={s.meta}>
          <span>
            {n.alertCount.toLocaleString()} active NWS alerts read ·{" "}
            {n.spcOk
              ? `SPC Day 1: ${n.spc ?? "none"}`
              : "SPC outlook unavailable"}
          </span>
          <button onClick={refresh} disabled={busy} aria-label="Refresh">
            <RefreshCw className={busy ? s.spin : undefined} aria-hidden />
            {time(n.at)}
          </button>
        </div>
      </section>

      {n.total > 0 && (
        <section className="grid gap-2">
          <p className="eyebrow">What makes up the score</p>
          <div
            className={s.stack}
            role="img"
            aria-label="Share of the score by category"
          >
            {live.map((c) => (
              <span
                key={c.key}
                style={{
                  width: `${(c.score / n.total) * 100}%`,
                  background: c.color,
                }}
                title={`${c.label}: ${c.score}`}
              />
            ))}
          </div>
          <ul className={s.legend}>
            {live.map((c) => (
              <li key={c.key}>
                <i style={{ background: c.color }} />
                {c.label} {Math.round((c.score / n.total) * 100)}%
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={s.parts}>
        {n.components.map((c, i) => (
          <article
            key={c.key}
            className={c.score > 0 ? s.partOn : s.part}
            style={{ ["--c" as string]: c.color, ["--i" as string]: i }}
          >
            <div className={s.partHead}>
              <span className={s.partIcon}>{ICONS[c.key]}</span>
              <span className={s.partLabel}>{c.label}</span>
              <b>
                {c.score}
                <small>/{c.cap}</small>
              </b>
            </div>
            <span className={s.partBar}>
              <i style={{ transform: `scaleX(${c.score / c.cap})` }} />
            </span>
            <p>{c.desc}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
