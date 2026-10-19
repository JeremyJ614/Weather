"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  Satellite,
  ScrollText,
  Tornado,
  Sparkles,
  Swords,
} from "lucide-react";
import { HomeTabs } from "@/features/news/HomeTabs";
import { TropicalMap, type ReconDot } from "@/features/tropical/TropicalMap";
import { SatLoop } from "@/features/tropical/SatLoop";
import { ModelBattle } from "@/features/tropical/ModelBattle";
import { GoogleAi } from "@/features/tropical/GoogleAi";
import { pick, type Colors } from "@/lib/colors/pick";
import type { Outlook, TwoText } from "@/lib/tropical/nhc";
import {
  BASINS,
  INTENSITY,
  RISK,
  WATCH,
  compass,
  mph,
  tierOf,
  type BasinId,
} from "@/lib/tropical/style";
import { ROSTER } from "@/lib/tropical/atcf";
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
  const [recon, setRecon] = useState<Mission[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/tropical/recon")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { missions: Mission[] }) => live && setRecon(d.missions))
      .catch(() => live && setRecon([]));
    return () => {
      live = false;
    };
  }, []);
  const dots: ReconDot[] = (recon ?? [])
    .filter((r) => r.lat != null && r.lon != null)
    .map((r) => ({
      key: r.key,
      lat: r.lat!,
      lon: r.lon!,
      label: r.storm,
      active: r.active,
    }));
  return (
    <div className="grid gap-4">
      <section className={s.basin}>
        <header>
          <small>Live basin</small>
          <h3>The tropics right now</h3>
        </header>
        <TropicalMap
          geo={data.geo}
          start={busiest}
          storms={data.storms}
          recon={dots}
          wide
        />
        <Legend colors={colors} />
      </section>
      <Summary data={data} airborne={recon?.filter((r) => r.active).length} />
      <HomeTabs
        label="Tropical"
        variant="pills"
        tabs={[
          {
            id: "trop-storms",
            label: `Storms${data.storms.length ? ` · ${data.storms.length}` : ""}`,
            icon: <Tornado aria-hidden />,
            panel: data.storms.length ? (
              <StormPage
                data={data}
                colors={colors}
                recon={recon}
                dots={dots}
              />
            ) : (
              <p className={s.empty}>
                No active storms in the Atlantic, East Pacific or Central
                Pacific right now.
              </p>
            ),
          },
          {
            id: "trop-ai",
            label: "Google AI",
            icon: <Sparkles aria-hidden />,
            panel: (
              <GoogleAi
                colors={colors}
                storms={data.storms.map((x) => ({
                  id: x.id,
                  title: x.title,
                  lat: x.lat,
                  lon: x.lon,
                }))}
              />
            ),
          },
          {
            id: "trop-models",
            label: "Battle Royale",
            icon: <Swords aria-hidden />,
            panel: (
              <ModelBattle
                colors={colors}
                storms={data.storms.map((x) => ({
                  id: x.id,
                  title: x.title,
                  lat: x.lat,
                  lon: x.lon,
                }))}
              />
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

function Summary({
  data,
  airborne,
}: {
  data: Outlook;
  airborne: number | undefined;
}) {
  const areas = Math.max(
    data.areas.length,
    data.geo.areas.features?.length ?? 0,
    data.text.reduce((a, t) => a + t.items.length, 0),
  );
  return (
    <div className={s.summary}>
      <div data-tone="storm">
        <b>{data.storms.length}</b>
        <span>active {data.storms.length === 1 ? "system" : "systems"}</span>
      </div>
      <div data-tone="watch">
        <b>{areas}</b>
        <span>{areas === 1 ? "area" : "areas"} watched</span>
      </div>
      <div>
        <b>{airborne ?? "–"}</b>
        <span>recon airborne</span>
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

type Mission = {
  key: string;
  aircraft: string;
  storm: string;
  stormId: string | null;
  fix: string | null;
  lastOb: string | null;
  lat: number | null;
  lon: number | null;
  mslp: number | null;
  flKt: number | null;
  sfcKt: number | null;
  ob: string | null;
  active: boolean;
};
const SUBTABS = ["Forecast", "Satellite", "Map", "Models", "Recon"] as const;

/** One storm at a time, VIP's storm page: forecast, satellite, map, models and recon. */
function StormPage({
  data,
  colors,
  recon,
  dots,
}: {
  data: Outlook;
  colors: Colors;
  recon: Mission[] | null;
  dots: ReconDot[];
}) {
  const [id, setId] = useState(data.storms[0].id);
  const [tab, setTab] = useState<(typeof SUBTABS)[number]>("Forecast");
  const x = data.storms.find((v) => v.id === id) ?? data.storms[0];
  const now = x.points[0];
  const cat = tierOf(x.kt);
  const catColor = pick(colors, `trop:${cat.key}`, cat.color);
  const missions = (recon ?? []).filter(
    (m) =>
      m.stormId?.toLowerCase() === x.id.toLowerCase() ||
      m.storm.toUpperCase() === x.name.toUpperCase(),
  );
  return (
    <article className={s.stormPage} style={{ ["--tone" as string]: catColor }}>
      <header className={s.stormHead}>
        <small>
          {basinName(x.basin)} · {x.id.toUpperCase()}
        </small>
        <h3>{x.name.toUpperCase()}</h3>
        <span className={s.stormTier}>
          {cat.label}
          <small>
            {Math.abs(x.lat).toFixed(1)}°{x.lat >= 0 ? "N" : "S"},{" "}
            {Math.abs(x.lon).toFixed(1)}°{x.lon <= 0 ? "W" : "E"}
          </small>
        </span>
      </header>
      {data.storms.length > 1 && (
        <div className={s.stormChips} role="group" aria-label="Storm">
          {data.storms.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={v.id === x.id}
              onClick={() => setId(v.id)}
              style={{ ["--c" as string]: v.color }}
            >
              <i />
              {v.name.toUpperCase()}
              <small>{tierOf(v.kt).short}</small>
            </button>
          ))}
        </div>
      )}
      <div className={s.subtabs} role="tablist" aria-label="Storm detail">
        {SUBTABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === tab}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Forecast" && (
        <section className={s.panel}>
          <header>
            <small>Valid {when(x.updated)}</small>
            <h4>Current conditions</h4>
            <em>Advisory #{x.advisory ?? "–"}</em>
          </header>
          <div className={s.conditions}>
            <div data-accent>
              <small>Sustained</small>
              <b>
                {x.mph} <span>mph</span>
              </b>
              <span>{x.kt} kt</span>
            </div>
            <div>
              <small>Gusts</small>
              <b>
                {now?.gustMph ?? "–"} <span>mph</span>
              </b>
              <span>
                {now?.gustMph ? `${Math.round(now.gustMph / 1.15078)} kt` : ""}
              </span>
            </div>
            <div>
              <small>Pressure</small>
              <b>
                {x.pressure ?? "–"} <span>mb</span>
              </b>
              <span>minimum central</span>
            </div>
            <div>
              <small>Movement</small>
              <b>{x.dir != null ? compass(x.dir) : "–"}</b>
              <span>
                {x.speedMph != null ? `at ${x.speedMph} mph` : "stationary"}
              </span>
            </div>
            <div>
              <small>Type</small>
              <b>{kind(x.kt, x.title, x.name).short}</b>
              <span>{kind(x.kt, x.title, x.name).long}</span>
            </div>
            <div data-accent>
              <small>Category</small>
              <b>{cat.short}</b>
              <span>{range(cat.key)}</span>
            </div>
          </div>
          {x.warnings.length > 0 && (
            <p className={s.warn}>
              {x.warnings.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </p>
          )}
          <nav className={s.links}>
            {(
              [
                ["NHC advisory", x.links.advisory],
                ["Discussion", x.links.discussion],
                ["Forecast advisory", x.links.forecast],
                ["Cone graphic", x.links.graphics],
              ] as const
            )
              .filter(([, u]) => u)
              .map(([l, u]) => (
                <a key={l} href={u} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden /> {l}
                </a>
              ))}
          </nav>
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
                    <td>
                      {p.tau ? `${p.when} (+${p.tau} h)` : `${p.when} (now)`}
                    </td>
                    <td>{p.mph} mph</td>
                    <td>{p.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
      {tab === "Satellite" && (
        <section className={s.panel}>
          <header>
            <small>Live imagery</small>
            <h4>Satellite loop</h4>
          </header>
          <SatLoop key={x.id} src={x.id.toUpperCase()} ratio="1 / 1" />
        </section>
      )}
      {tab === "Map" && (
        <section className={s.panel}>
          <header>
            <small>Forecast cone &amp; track</small>
            <h4>{x.name}</h4>
          </header>
          <TropicalMap
            key={x.id}
            geo={data.geo}
            start={x.basin}
            storms={data.storms}
            recon={dots}
            focus={{ lat: x.lat, lon: x.lon }}
          />
          <Legend colors={colors} />
        </section>
      )}
      {tab === "Models" && <StormModels key={x.id} id={x.id} colors={colors} />}
      {tab === "Recon" && (
        <section className={s.panel}>
          <header>
            <small>Aircraft reconnaissance</small>
            <h4>Hurricane Hunters</h4>
          </header>
          {!recon ? (
            <p className={s.empty}>Reading the vortex data messages…</p>
          ) : !missions.length ? (
            <p className={s.empty}>
              No recon into {x.name} in the last 30 hours. The Hurricane Hunters
              fly when a system threatens land or NHC needs a fix; missions show
              here within minutes of the first transmission.
            </p>
          ) : (
            <ul className={s.missions}>
              {missions.map((m) => (
                <li key={m.key} data-active={m.active || undefined}>
                  <b>
                    {m.aircraft}{" "}
                    <small>{m.active ? "Airborne" : "Completed"}</small>
                  </b>
                  <span>
                    {m.mslp ? `${m.mslp} mb · ` : ""}
                    {m.flKt ? `flight-level ${mph(m.flKt)} mph · ` : ""}
                    {m.sfcKt ? `surface ${mph(m.sfcKt)} mph · ` : ""}
                    {m.fix
                      ? `fix ${when(m.fix)}`
                      : m.lastOb
                        ? `last ob ${when(m.lastOb)}`
                        : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className={s.note}>
            Pressure comes only from the centre fix (vortex data message);
            surface winds are the SFMR peak from the live observations.
          </p>
        </section>
      )}
    </article>
  );
}

const RANGES: Record<string, string> = {
  TD: "under 39 mph",
  TS: "39–73 mph",
  C1: "74–95 mph",
  C2: "96–110 mph",
  C3: "111–129 mph",
  C4: "130–156 mph",
  C5: "157 mph or more",
};
const range = (k: string) => RANGES[k] ?? "";
/** What NHC calls the system (hurricane, post-tropical, potential cyclone…), short and long. */
function kind(kt: number, title: string, name: string) {
  const long =
    title
      .replace(name, "")
      .replace(/Category \d\s*/i, "")
      .trim() ||
    (kt >= 64
      ? "Hurricane"
      : kt >= 34
        ? "Tropical Storm"
        : "Tropical Depression");
  const short = /potential/i.test(long)
    ? "PTC"
    : /post/i.test(long)
      ? "PT"
      : /hurricane/i.test(long)
        ? "HU"
        : /storm/i.test(long)
          ? "TS"
          : /depression/i.test(long)
            ? "TD"
            : long.slice(0, 3).toUpperCase();
  return { short, long };
}
const NAMES = new Map(ROSTER.map((m) => [m.tech, m]));

/** Peak sustained wind by model, from NHC's ATCF guidance (VIP's Intensity view). */
function StormModels({ id, colors }: { id: string; colors: Colors }) {
  const [d, setD] = useState<
    | {
        tracks: {
          tech: string;
          dtg: string;
          points: { kt: number }[];
        }[];
      }
    | "error"
    | null
  >(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/tropical/models?storm=${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => live && setD(j))
      .catch(() => live && setD("error"));
    return () => {
      live = false;
    };
  }, [id]);
  const rows =
    d && d !== "error"
      ? d.tracks
          .map((t) => ({
            tech: t.tech,
            kt: Math.max(0, ...t.points.map((p) => p.kt || 0)),
          }))
          .filter((r) => r.kt > 0)
          .sort((a, b) => b.kt - a.kt)
      : [];
  const top = Math.max(1, ...rows.map((r) => r.kt));
  const dtg = d && d !== "error" ? d.tracks[0]?.dtg : null;
  return (
    <section className={s.panel}>
      <header>
        <small>
          {dtg
            ? `Initialized ${new Date(Date.UTC(+dtg.slice(0, 4), +dtg.slice(4, 6) - 1, +dtg.slice(6, 8), +dtg.slice(8, 10))).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" })}`
            : "Model guidance"}
        </small>
        <h4>Peak sustained wind by model</h4>
      </header>
      {d === "error" ? (
        <p className={s.empty}>NHC&apos;s model data isn&apos;t answering.</p>
      ) : !d ? (
        <p className={s.empty}>Loading the guidance…</p>
      ) : (
        <ol className={s.peaks}>
          {rows.map((r, i) => {
            const t = tierOf(r.kt);
            const c = pick(colors, `trop:${t.key}`, t.color);
            const m = NAMES.get(r.tech);
            return (
              <li key={r.tech} data-official={r.tech === "OFCL" || undefined}>
                <span>{i + 1}</span>
                <span
                  className={s.dot}
                  style={{
                    ["--c" as string]: pick(
                      colors,
                      `model:${r.tech}`,
                      m?.color ?? "#888888",
                    ),
                  }}
                >
                  <i />
                  {m?.name ?? r.tech}
                </span>
                <u>
                  <em
                    style={{
                      background: c,
                      transform: `scaleX(${r.kt / top})`,
                    }}
                  />
                </u>
                <b>{mph(r.kt)}</b>
                <small style={{ color: c }}>{t.short}</small>
              </li>
            );
          })}
        </ol>
      )}
      <p className={s.note}>
        NOAA/NHC ATCF automated tracker aids. Wind in mph. Guidance only: the
        official forecast is NHC Official. The Battle Royale tab races every
        model&apos;s track.
      </p>
    </section>
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
