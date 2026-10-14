"use client";

import { useState } from "react";
import {
  ExternalLink,
  Map as MapIcon,
  Satellite,
  ScrollText,
  Tornado,
} from "lucide-react";
import { HomeTabs } from "@/features/news/HomeTabs";
import { TropicalMap } from "@/features/tropical/TropicalMap";
import { SatLoop } from "@/features/tropical/SatLoop";
import { pick, type Colors } from "@/lib/colors/pick";
import type { Outlook, Storm, TwoText } from "@/lib/tropical/nhc";
import {
  BASINS,
  INTENSITY,
  RISK,
  WATCH,
  compass,
  type BasinId,
} from "@/lib/tropical/style";
import s from "./Tropical.module.css";

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        timeZone: "America/Chicago",
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      }) + " CT"
    : "";
const riskOf = (pct: number | null) =>
  pct == null ? "low" : pct >= 60 ? "high" : pct >= 40 ? "medium" : "low";
const basinName = (id: string) => BASINS.find((b) => b.id === id)?.name ?? id;

/** Tropical Outlook: the basin map, active storms, the text outlooks and satellite. */
export function TropicalView({
  data,
  colors,
}: {
  data: Outlook;
  colors: Colors;
}) {
  const busiest =
    BASINS.find((b) => data.storms.some((x) => x.basin === b.id))?.id ??
    BASINS.find((b) => data.text.find((t) => t.basin === b.id)?.items.length)
      ?.id ??
    "AL";
  const risk = (k: string) => pick(colors, `trop:risk:${k}`, RISK[k]);
  return (
    <div className="grid gap-4">
      <Summary data={data} />
      <HomeTabs
        label="Tropical"
        tabs={[
          {
            id: "trop-map",
            label: "Map",
            icon: <MapIcon aria-hidden />,
            panel: (
              <div className="grid gap-3">
                <TropicalMap geo={data.geo} start={busiest} />
                <Legend colors={colors} />
              </div>
            ),
          },
          {
            id: "trop-storms",
            label: `Storms${data.storms.length ? ` · ${data.storms.length}` : ""}`,
            icon: <Tornado aria-hidden />,
            panel: data.storms.length ? (
              <div className="grid gap-3">
                {data.storms.map((x) => (
                  <StormCard key={x.id} s={x} />
                ))}
              </div>
            ) : (
              <p className={s.empty}>
                No active storms in the Atlantic, East Pacific or Central
                Pacific right now.
              </p>
            ),
          },
          {
            id: "trop-outlook",
            label: "7-Day Outlook",
            icon: <ScrollText aria-hidden />,
            panel: (
              <div className="grid gap-3">
                {data.text.map((t) => (
                  <TextOutlook key={t.basin} t={t} risk={risk} />
                ))}
              </div>
            ),
          },
          {
            id: "trop-sat",
            label: "Satellite",
            icon: <Satellite aria-hidden />,
            panel: <BasinLoop start={busiest} />,
          },
        ]}
      />
      <p className={s.foot}>
        Source: NOAA National Hurricane Center (map service, advisories and
        outlooks) and NESDIS STAR GOES imagery. Refreshed every 10 minutes.
        Always follow your local officials during a storm.
      </p>
    </div>
  );
}

function Summary({ data }: { data: Outlook }) {
  const areas = data.text.reduce((a, t) => a + t.items.length, 0);
  return (
    <div className={s.summary}>
      <div>
        <b>{data.storms.length}</b>
        <span>active {data.storms.length === 1 ? "storm" : "storms"}</span>
      </div>
      <div>
        <b>{areas}</b>
        <span>{areas === 1 ? "area" : "areas"} to watch</span>
      </div>
      <div>
        <b>{data.storms.filter((x) => x.kt >= 64).length}</b>
        <span>hurricanes</span>
      </div>
    </div>
  );
}

function Legend({ colors }: { colors: Colors }) {
  return (
    <div className={s.legend}>
      {INTENSITY.map((t) => (
        <span key={t.key}>
          <i style={{ background: pick(colors, `trop:${t.key}`, t.color) }} />
          {t.short}
        </span>
      ))}
      {Object.entries(RISK).map(([k, v]) => (
        <span key={k}>
          <i
            className={s.area}
            style={{ borderColor: pick(colors, `trop:risk:${k}`, v) }}
          />
          {k} chance
        </span>
      ))}
      {Object.entries(WATCH).map(([k, v]) => (
        <span key={k}>
          <i
            className={s.bar}
            style={{ background: pick(colors, `trop:ww:${k}`, v.color) }}
          />
          {v.label}
        </span>
      ))}
    </div>
  );
}

function StormCard({ s: x }: { s: Storm }) {
  const now = x.points[0];
  const [loop, setLoop] = useState(false);
  return (
    <article className={s.storm} style={{ ["--tone" as string]: x.color }}>
      <header>
        <span className={s.badge}>{x.tier}</span>
        <h3>{x.title}</h3>
        <small>
          {basinName(x.basin)} · Advisory {x.advisory ?? "–"} ·{" "}
          {when(x.updated)}
        </small>
      </header>
      <div className={s.stats}>
        <div>
          <b>{x.mph}</b>
          <span>mph winds</span>
        </div>
        <div>
          <b>{now?.gustMph ?? "–"}</b>
          <span>mph gusts</span>
        </div>
        <div>
          <b>{x.pressure ?? "–"}</b>
          <span>mb pressure</span>
        </div>
        <div>
          <b>{x.dir != null ? compass(x.dir) : "–"}</b>
          <span>{x.speedMph != null ? `${x.speedMph} mph` : "moving"}</span>
        </div>
      </div>
      {x.warnings.length > 0 && (
        <p className={s.warn}>
          {x.warnings.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </p>
      )}
      {x.points.length > 1 && (
        <table className={s.table}>
          <thead>
            <tr>
              <th>Forecast</th>
              <th>Winds</th>
              <th>Strength</th>
            </tr>
          </thead>
          <tbody>
            {x.points.map((p) => (
              <tr key={p.tau}>
                <td>{p.tau ? `${p.when} (+${p.tau} h)` : `${p.when} (now)`}</td>
                <td>{p.mph} mph</td>
                <td>{p.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <details
        className={s.loop}
        onToggle={(e) => e.currentTarget.open && setLoop(true)}
      >
        <summary>Satellite loop</summary>
        {loop && <SatLoop src={x.id.toUpperCase()} ratio="1 / 1" />}
      </details>
      <nav className={s.links}>
        {(
          [
            ["Public advisory", x.links.advisory],
            ["Discussion", x.links.discussion],
            ["Graphics", x.links.graphics],
            ["Forecast advisory", x.links.forecast],
          ] as const
        )
          .filter(([, u]) => u)
          .map(([l, u]) => (
            <a key={l} href={u} target="_blank" rel="noreferrer">
              {l} <ExternalLink aria-hidden />
            </a>
          ))}
      </nav>
    </article>
  );
}

function TextOutlook({ t, risk }: { t: TwoText; risk: (k: string) => string }) {
  return (
    <section className={s.two}>
      <header>
        <h3>{basinName(t.basin)}</h3>
        <small>{t.issued ? `Issued ${when(t.issued)}` : "Not issued"}</small>
      </header>
      {t.items.length === 0 ? (
        <p className={s.calm}>{t.intro || "No outlook text right now."}</p>
      ) : (
        <>
          {t.items.map((i) => (
            <div key={i.title} className={s.system}>
              <b>{i.title}</b>
              {(["two", "seven"] as const).map((k) => {
                const v = i[k];
                return (
                  <div
                    key={k}
                    className={s.chance}
                    style={{ ["--c" as string]: risk(riskOf(v)) }}
                  >
                    <span>{k === "two" ? "48 hours" : "7 days"}</span>
                    <i>
                      <em style={{ transform: `scaleX(${(v ?? 0) / 100})` }} />
                    </i>
                    <b>{v == null ? "–" : `${v}%`}</b>
                  </div>
                );
              })}
              <p>{i.body}</p>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

function BasinLoop({ start }: { start: BasinId }) {
  const [b, setB] = useState<BasinId>(start);
  return (
    <div className="grid gap-2">
      <div className="flex gap-1.5" role="group" aria-label="Basin">
        {BASINS.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={b === x.id}
            onClick={() => setB(x.id)}
            className="min-h-9 rounded-full border border-line px-3 text-xs font-semibold aria-pressed:border-[var(--lit-line)] aria-pressed:bg-[var(--lit)] aria-pressed:text-accent"
          >
            {x.name}
          </button>
        ))}
      </div>
      <SatLoop key={b} src={b} />
    </div>
  );
}
