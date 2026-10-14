"use client";

import { useEffect, useMemo, useState } from "react";
import { Flame, List, Map as MapIcon, MapPin, Siren, Wind } from "lucide-react";
import { HomeTabs } from "@/features/news/HomeTabs";
import { FireMap } from "@/features/fire/FireMap";
import { GeoMap } from "@/features/hazards/GeoMap";
import { usePlaces } from "@/features/location/usePlaces";
import { pick, type Colors } from "@/lib/colors/pick";
import type { Fire } from "@/lib/fire/data";
import { CONTAIN, FIRE_RISK, containColor, miles } from "@/lib/fire/style";
import s from "./Fire.module.css";

type Outlook = { day: number; valid: string | null; areas: string[] | null };
const ago = (iso: string | null) => {
  if (!iso) return "";
  const d = Math.round((Date.now() - Date.parse(iso)) / 86400000);
  return d < 1 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};
const acres = (n: number) => `${n.toLocaleString("en-US")} acres`;

/** Fire Weather: your area, the wildfire map, the fire list and SPC's fire outlooks. */
export function FireView({
  fires,
  outlooks,
  colors,
}: {
  fires: Fire[] | null;
  outlooks: Outlook[];
  colors: Colors;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const [layer, setLayer] = useState<"none" | "day1" | "day2">("none");
  const [focus, setFocus] = useState<{
    lat: number;
    lon: number;
    acres: number;
  } | null>(null);
  const [sort, setSort] = useState<"size" | "new">("size");
  const picked = fires?.find((f) => f.id === sel) ?? null;
  const show = (f: Fire) => {
    setSel(f.id);
    setFocus({ lat: f.lat, lon: f.lon, acres: f.acres });
  };
  const list = useMemo(
    () =>
      [...(fires ?? [])].sort((a, b) =>
        sort === "size"
          ? b.acres - a.acres
          : (b.started ?? "").localeCompare(a.started ?? ""),
      ),
    [fires, sort],
  );
  const total = (fires ?? []).reduce((a, f) => a + f.acres, 0);

  return (
    <div className="grid gap-4">
      <div className={s.summary}>
        <div>
          <b>{fires ? fires.length : "–"}</b>
          <span>active wildfires</span>
        </div>
        <div>
          <b>
            {fires
              ? total >= 1e6
                ? `${(total / 1e6).toFixed(1)}M`
                : `${Math.round(total / 1000)}k`
              : "–"}
          </b>
          <span>acres burning</span>
        </div>
        <div>
          <b>{outlooks[0].areas ? outlooks[0].areas.length : "–"}</b>
          <span>fire risks today</span>
        </div>
      </div>
      <YourArea fires={fires} onShow={show} colors={colors} />
      <HomeTabs
        label="Fire"
        tabs={[
          {
            id: "fire-map",
            label: "Wildfire Map",
            icon: <MapIcon aria-hidden />,
            panel: (
              <div className="grid gap-3">
                <div
                  className="flex flex-wrap gap-1.5"
                  role="group"
                  aria-label="Fire outlook overlay"
                >
                  {(
                    [
                      ["none", "Fires"],
                      ["day1", "+ Today's risk"],
                      ["day2", "+ Tomorrow"],
                    ] as const
                  ).map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={layer === k}
                      onClick={() => setLayer(k)}
                      className={s.pill}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <FireMap outlook={layer} focus={focus} onPick={setSel} />
                  {picked && (
                    <FireCard
                      f={picked}
                      colors={colors}
                      onClose={() => setSel(null)}
                      floating
                    />
                  )}
                </div>
                <div className={s.legend}>
                  {CONTAIN.map((c) => (
                    <span key={c.key}>
                      <i
                        style={{
                          background: pick(
                            colors,
                            `fire:contain:${c.key}`,
                            c.color,
                          ),
                        }}
                      />
                      {c.label}
                    </span>
                  ))}
                  <span>
                    <i className={s.perim} /> Burn area
                  </span>
                </div>
              </div>
            ),
          },
          {
            id: "fire-list",
            label: "Fire List",
            icon: <List aria-hidden />,
            panel: !fires ? (
              <p className={s.muted}>
                The national wildfire feed isn&apos;t answering right now.
              </p>
            ) : (
              <div className="grid gap-2">
                <div className="flex gap-1.5" role="group" aria-label="Sort">
                  {(
                    [
                      ["size", "Largest"],
                      ["new", "Newest"],
                    ] as const
                  ).map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={sort === k}
                      onClick={() => setSort(k)}
                      className={s.pill}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                {list.map((f) => (
                  <FireCard key={f.id} f={f} colors={colors} />
                ))}
              </div>
            ),
          },
          {
            id: "fire-outlook",
            label: "Fire Outlook",
            icon: <Wind aria-hidden />,
            panel: <FireOutlook outlooks={outlooks} colors={colors} />,
          },
        ]}
      />
      <p className={s.foot}>
        Sources: National Interagency Fire Center WFIGS (fires of 10+ acres not
        yet fully contained, perimeters of 100+ acres), NOAA Storm Prediction
        Center fire weather outlooks and National Weather Service alerts. Follow
        local officials for evacuations.
      </p>
    </div>
  );
}

function FireCard({
  f,
  colors,
  onClose,
  floating,
}: {
  f: Fire;
  colors: Colors;
  onClose?: () => void;
  floating?: boolean;
}) {
  const c = containColor(f.contained, colors);
  return (
    <article
      className={`${s.fire} ${floating ? s.float : ""}`}
      style={{ ["--c" as string]: c }}
      onClick={onClose}
    >
      <header>
        <Flame aria-hidden />
        <b>{f.name}</b>
        <span>
          {[f.county && `${f.county} Co.`, f.state].filter(Boolean).join(", ")}
        </span>
      </header>
      <div className={s.facts}>
        <span>
          <b>{acres(f.acres)}</b>
        </span>
        <span>
          <b>{f.contained == null ? "–" : `${f.contained}%`}</b> contained
        </span>
        <span>started {ago(f.started)}</span>
        {f.personnel ? (
          <span>{f.personnel.toLocaleString("en-US")} personnel</span>
        ) : null}
        {f.cause && f.cause !== "Undetermined" ? <span>{f.cause}</span> : null}
      </div>
      <i className={s.contain}>
        <em style={{ transform: `scaleX(${(f.contained ?? 0) / 100})` }} />
      </i>
      {(f.behavior || f.about) && (
        <p>
          {[f.behavior && `Behavior: ${f.behavior}.`, f.about]
            .filter(Boolean)
            .join(" ")}
        </p>
      )}
    </article>
  );
}

function YourArea({
  fires,
  onShow,
  colors,
}: {
  fires: Fire[] | null;
  onShow: (f: Fire) => void;
  colors: Colors;
}) {
  const { active } = usePlaces();
  const key = active ? `${active.lat},${active.lon}` : "";
  const [res, setRes] = useState<{
    key: string;
    alerts: { event: string; ends: string | null }[];
  } | null>(null);
  useEffect(() => {
    if (!active) return;
    let live = true;
    fetch(`/api/fire/here?lat=${active.lat}&lon=${active.lon}`)
      .then((r) => (r.ok ? r.json() : { alerts: [] }))
      .then((d) => live && setRes({ key, alerts: d.alerts ?? [] }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- key is the place
  if (!active)
    return (
      <p className={s.card}>
        Set your location on the Homepage to see the fires nearest you.
      </p>
    );
  const near = (fires ?? [])
    .map((f) => ({ f, mi: miles(active, f) }))
    .filter((x) => x.mi <= 250)
    .sort((a, b) => a.mi - b.mi)
    .slice(0, 4);
  const alerts = res?.key === key ? res.alerts : [];
  return (
    <section className={s.card}>
      <p className={s.place}>
        <MapPin aria-hidden /> {active.label}
      </p>
      {alerts.map((a) => (
        <p key={a.event} className={s.alert}>
          <Siren aria-hidden />
          <b>{a.event}</b>
          {a.ends && (
            <small>
              until{" "}
              {new Date(a.ends).toLocaleString("en-US", {
                timeZone: "America/Chicago",
                weekday: "short",
                hour: "numeric",
              })}{" "}
              CT
            </small>
          )}
        </p>
      ))}
      {near.length ? (
        <ul className={s.near}>
          {near.map(({ f, mi }) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onShow(f)}
                style={{ ["--c" as string]: containColor(f.contained, colors) }}
              >
                <i />
                <span>
                  <b>{f.name}</b>
                  <small>
                    {Math.round(mi)} mi away · {acres(f.acres)} ·{" "}
                    {f.contained == null
                      ? "containment not reported"
                      : `${f.contained}% contained`}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.muted}>
          No active wildfires of 10+ acres within 250 miles.
        </p>
      )}
    </section>
  );
}

function FireOutlook({
  outlooks,
  colors,
}: {
  outlooks: Outlook[];
  colors: Colors;
}) {
  const [day, setDay] = useState(1);
  const o = outlooks.find((x) => x.day === day)!;
  return (
    <div className="grid gap-3">
      <div className="flex gap-1.5" role="group" aria-label="Day">
        {outlooks.map((x) => (
          <button
            key={x.day}
            type="button"
            aria-pressed={x.day === day}
            onClick={() => setDay(x.day)}
            className={s.pill}
          >
            {x.day === 1 ? "Today" : "Tomorrow"}
          </button>
        ))}
      </div>
      <GeoMap
        url={`/api/fire/map?layer=day${day}`}
        label={`SPC fire weather outlook, ${day === 1 ? "today" : "tomorrow"}`}
      />
      <p className={s.muted}>
        {o.areas === null
          ? "SPC's fire outlook isn't answering right now."
          : o.areas.length
            ? `Areas: ${o.areas.join(", ")}.`
            : "No elevated fire weather areas outlooked."}
        {o.valid ? ` Valid ${o.valid}.` : ""}
      </p>
      <div className={s.legend}>
        {Object.entries(FIRE_RISK).map(([k, v]) => (
          <span key={k}>
            <i style={{ background: pick(colors, `fire:${k}`, v.color) }} />
            {v.label}
          </span>
        ))}
      </div>
      <p className={s.muted}>
        Elevated, critical and extremely critical areas come from strong winds
        with very dry air; dry thunderstorm areas are lightning with little
        rain, which starts new fires.
      </p>
    </div>
  );
}
