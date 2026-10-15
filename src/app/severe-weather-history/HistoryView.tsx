"use client";

import { useEffect, useMemo, useState } from "react";
import { Siren, Tornado } from "lucide-react";
import { HomeTabs } from "@/features/news/HomeTabs";
import { UsMap } from "@/features/maps/UsMap";
import { pick, type Colors } from "@/lib/colors/pick";
import { EF_COLORS } from "@/lib/colors/ef";
import { COLOR as WARN } from "@/lib/warnings/style";
import type { Track, WarnPoly } from "@/lib/history/data";
import s from "./History.module.css";

const EF_ORDER = ["EFU", "EF0", "EF1", "EF2", "EF3", "EF4", "EF5"];
const KIND = {
  TO: "Tornado Warning",
  SV: "Severe Thunderstorm Warning",
  FF: "Flash Flood Warning",
} as const;
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const day = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/** Loads one JSON endpoint per key, remembering what it already fetched this visit. */
function useJson<T>(url: string) {
  const [res, setRes] = useState<{ url: string; d: T | "error" } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: T) => live && setRes({ url, d }))
      .catch(() => live && setRes({ url, d: "error" }));
    return () => {
      live = false;
    };
  }, [url]);
  return res?.url === url ? res.d : null;
}

/** Severe Weather History: tornado tracks and the warning archive. */
export function HistoryView({
  colors,
  year,
}: {
  colors: Colors;
  year: number;
}) {
  return (
    <div className="grid gap-4">
      <HomeTabs
        label="History"
        tabs={[
          {
            id: "h-tor",
            label: "Tornado Tracks",
            icon: <Tornado aria-hidden />,
            panel: <Tornadoes colors={colors} year={year} />,
          },
          {
            id: "h-warn",
            label: "Warnings",
            icon: <Siren aria-hidden />,
            panel: <Warnings colors={colors} />,
          },
        ]}
      />
      <p className={s.foot}>
        Sources: NWS Damage Assessment Toolkit (surveyed tracks; recent surveys
        may still be in progress) and the Iowa Environmental Mesonet storm-based
        warning archive. Finished years are cached, so they open instantly.
      </p>
    </div>
  );
}

function Tornadoes({ colors, year }: { colors: Colors; year: number }) {
  const periods = useMemo(
    () => [
      { id: "days=30", label: "30 days" },
      { id: "days=90", label: "90 days" },
      { id: "days=365", label: "12 months" },
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `year=${year - i}`,
        label: String(year - i),
      })),
    ],
    [year],
  );
  const [period, setPeriod] = useState(`year=${year - 1}`);
  const [hide, setHide] = useState<Set<string>>(new Set());
  const data = useJson<{ tracks: Track[] }>(`/api/history/tornadoes?${period}`);
  const all = data && data !== "error" ? data.tracks : [];
  const shown = all.filter((t) => !hide.has(t.ef));
  const c = (ef: string) => pick(colors, `ef:${ef}`, EF_COLORS[ef]);
  const count = (ef: string) => all.filter((t) => t.ef === ef).length;
  const strong = all.filter((t) => ["EF3", "EF4", "EF5"].includes(t.ef)).length;
  const longest = all.reduce<Track | null>(
    (a, t) => (!a || t.miles > a.miles ? t : a),
    null,
  );
  const deaths = all.reduce((a, t) => a + t.deaths, 0);
  const hurt = all.reduce((a, t) => a + t.hurt, 0);
  const isYear = period.startsWith("year=");
  const months = MONTHS.map(
    (_, i) => all.filter((t) => Number(t.date.slice(5, 7)) === i + 1).length,
  );
  const peak = Math.max(1, ...months);
  const status = !data
    ? "loading"
    : data === "error"
      ? "error"
      : all.length
        ? "ready"
        : "empty";

  return (
    <div className="grid gap-3">
      <div className={s.pills} role="group" aria-label="Period">
        {periods.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === period}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className={s.band}>
        <div>
          <b>{data ? all.length.toLocaleString("en-US") : "–"}</b>
          <span>tornado tracks</span>
        </div>
        <div>
          <b>{data ? strong : "–"}</b>
          <span>EF3 or stronger</span>
        </div>
        <div>
          <b>{longest ? `${longest.miles} mi` : "–"}</b>
          <span>longest track</span>
        </div>
        <div>
          <b>{data ? deaths : "–"}</b>
          <span>deaths · {hurt} hurt</span>
        </div>
      </div>
      {all.length > 0 && (
        <div className={s.comp} role="img" aria-label="Tracks by rating">
          {EF_ORDER.map((ef) =>
            count(ef) ? (
              <i
                key={ef}
                style={{ flexGrow: count(ef), background: c(ef) }}
                title={`${ef}: ${count(ef)}`}
              />
            ) : null,
          )}
        </div>
      )}
      <div className={s.chips} role="group" aria-label="Show ratings">
        {EF_ORDER.map((ef) => (
          <button
            key={ef}
            type="button"
            aria-pressed={!hide.has(ef)}
            onClick={() => {
              const n = new Set(hide);
              if (n.has(ef)) n.delete(ef);
              else n.add(ef);
              setHide(n);
            }}
            style={{ ["--c" as string]: c(ef) }}
          >
            <i />
            {ef} <small>{count(ef)}</small>
          </button>
        ))}
      </div>
      <UsMap
        title={`Tornado tracks · ${periods.find((p) => p.id === period)?.label}`}
        legend={EF_ORDER.map((ef) => ({ label: ef, color: c(ef) }))}
        status={status}
        file={`sswx-tornado-tracks-${period.replace("=", "-")}`}
      >
        {/* Weakest first so the strongest paths draw on top. */}
        {EF_ORDER.flatMap((ef, k) =>
          shown
            .filter((t) => t.ef === ef)
            .map((t, i) => (
              <path
                key={`${ef}${i}`}
                d={t.d}
                fill="none"
                stroke={c(ef)}
                strokeWidth={0.9 + k * 0.45}
                strokeLinecap="round"
                opacity={0.9}
              />
            )),
        )}
      </UsMap>
      {status === "empty" && (
        <p className={s.muted}>
          No surveyed tornado tracks in this period yet.
        </p>
      )}
      {isYear && all.length > 0 && (
        <section className={s.card}>
          <h3>By month</h3>
          <div className={s.months}>
            {months.map((n, i) => (
              <div key={MONTHS[i]}>
                <i style={{ transform: `scaleY(${n / peak})` }} />
                <span>{MONTHS[i][0]}</span>
                <b>{n || ""}</b>
              </div>
            ))}
          </div>
        </section>
      )}
      {all.length > 0 && (
        <section className={s.card}>
          <h3>Longest tracks</h3>
          <ol className={s.top}>
            {[...all]
              .sort((a, b) => b.miles - a.miles)
              .slice(0, 5)
              .map((t, i) => (
                <li key={i} style={{ ["--c" as string]: c(t.ef) }}>
                  <b>{t.ef}</b>
                  <span>
                    {t.miles} mi · {t.yards ? `${t.yards} yd wide · ` : ""}
                    {day(t.date)}
                    {t.deaths ? ` · ${t.deaths} killed` : ""}
                  </span>
                  <small>NWS {t.wfo}</small>
                </li>
              ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function Warnings({ colors }: { colors: Colors }) {
  const [days, setDays] = useState(3);
  const data = useJson<{ polys: WarnPoly[] }>(
    `/api/history/warnings?days=${days}`,
  );
  const polys = data && data !== "error" ? data.polys : [];
  const c = (k: keyof typeof KIND) =>
    pick(colors, `warn:${KIND[k]}`, WARN[KIND[k]]);
  const n = (k: keyof typeof KIND) => polys.filter((p) => p.kind === k).length;
  const top = polys.filter((p) => p.tier >= 2).length;
  const emergencies = polys.filter((p) => p.tier === 3).length;
  const status = !data
    ? "loading"
    : data === "error"
      ? "error"
      : polys.length
        ? "ready"
        : "empty";
  return (
    <div className="grid gap-3">
      <div className={s.pills} role="group" aria-label="Period">
        {[
          [1, "24 hours"],
          [3, "3 days"],
          [7, "7 days"],
          [30, "30 days"],
        ].map(([d, l]) => (
          <button
            key={d}
            type="button"
            aria-pressed={d === days}
            onClick={() => setDays(Number(d))}
          >
            {l}
          </button>
        ))}
      </div>
      <div className={s.band}>
        {(Object.keys(KIND) as (keyof typeof KIND)[]).map((k) => (
          <div key={k} style={{ ["--c" as string]: c(k) }}>
            <b className={s.tinted}>{data ? n(k) : "–"}</b>
            <span>{KIND[k].replace(" Warning", "")}</span>
          </div>
        ))}
        <div>
          <b>{data ? top : "–"}</b>
          <span>
            PDS / destructive
            {emergencies ? ` · ${emergencies} emergencies` : ""}
          </span>
        </div>
      </div>
      {polys.length > 0 && (
        <div className={s.comp} role="img" aria-label="Warnings by type">
          {(["TO", "SV", "FF"] as const).map((k) =>
            n(k) ? (
              <i key={k} style={{ flexGrow: n(k), background: c(k) }} />
            ) : null,
          )}
        </div>
      )}
      <UsMap
        title={`Severe warnings · last ${days === 1 ? "24 hours" : `${days} days`}`}
        legend={(Object.keys(KIND) as (keyof typeof KIND)[]).map((k) => ({
          label: KIND[k],
          color: c(k),
        }))}
        status={status}
        file={`sswx-warnings-${days}d`}
      >
        {polys.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fill={c(p.kind)}
            fillOpacity={0.5}
            stroke={p.tier ? "#ffffff" : c(p.kind)}
            strokeWidth={p.tier ? 0.4 + p.tier * 0.5 : 0.3}
          />
        ))}
      </UsMap>
      <p className={s.muted}>
        White outlines mark the warnings NWS tagged as considerable,
        destructive, particularly dangerous or an emergency.
      </p>
    </div>
  );
}
