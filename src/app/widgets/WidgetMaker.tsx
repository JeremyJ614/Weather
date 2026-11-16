"use client";

import { useEffect, useState } from "react";
import { usePlaces } from "@/features/location/usePlaces";
import s from "./Widgets.module.css";

const LIST = [
  {
    id: "sswxcon",
    name: "SSWXCon Score",
    sub: "How stormy the U.S. is right now",
    h: 190,
  },
  {
    id: "outlook",
    name: "SPC Day 1 Outlook",
    sub: "Today's severe weather risk map",
    h: 330,
  },
  {
    id: "radar",
    name: "Radar loop",
    sub: "Your nearest NWS radar, looping",
    h: 400,
  },
  {
    id: "local",
    name: "Your town",
    sub: "Conditions and active warnings",
    h: 230,
  },
] as const;
const SITE = "https://weather.sswx.space";

export function WidgetMaker() {
  const { active } = usePlaces();
  const [pick, setPick] = useState<(typeof LIST)[number]["id"]>("sswxcon");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [copied, setCopied] = useState(false);
  const w = LIST.find((x) => x.id === pick)!;
  const place = active ?? { lat: 35.47, lon: -97.52, label: "Oklahoma City" };
  // The NWS radar nearest the place (from the Radar Blind Spot list, loaded once if needed).
  const [radar, setRadar] = useState<string | null>(null);
  useEffect(() => {
    if (pick !== "radar" || radar) return;
    fetch("/extras/blindspot.json")
      .then((r) => r.json())
      .then(
        (m: {
          radars: { id: string; kind: string; lat: number; lon: number }[];
        }) => {
          const best = m.radars
            .filter((r) => r.kind === "NEXRAD")
            .map((r) => ({
              id: r.id,
              d: Math.hypot(
                r.lat - place.lat,
                (r.lon - place.lon) * Math.cos((place.lat * Math.PI) / 180),
              ),
            }))
            .sort((a, b) => a.d - b.d)[0];
          setRadar(best?.id ?? "CONUS");
        },
      )
      .catch(() => setRadar("CONUS"));
  }, [pick, radar, place.lat, place.lon]);
  const src =
    pick === "local"
      ? `${SITE}/embed/local?lat=${place.lat.toFixed(3)}&lon=${place.lon.toFixed(3)}&name=${encodeURIComponent(place.label)}&theme=${theme}`
      : pick === "radar"
        ? `${SITE}/embed/radar?site=${radar ?? "CONUS"}&theme=${theme}`
        : `${SITE}/embed/${pick}?theme=${theme}`;
  const code = `<iframe src="${src}" width="340" height="${w.h}" style="border:0;border-radius:16px;max-width:100%" loading="lazy" title="${w.name} by StormSync Weather"></iframe>`;
  return (
    <section className={s.wrap}>
      <div className={s.picker} role="tablist" aria-label="Widget">
        {LIST.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={pick === x.id}
            onClick={() => setPick(x.id)}
          >
            <b>{x.name}</b>
            <small>{x.sub}</small>
          </button>
        ))}
      </div>
      <div className={s.row} role="group" aria-label="Look">
        {(["dark", "light"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={theme === t}
            onClick={() => setTheme(t)}
          >
            {t === "dark" ? "Dark" : "Light"}
          </button>
        ))}
      </div>
      {(pick === "local" || pick === "radar") && (
        <p className={s.note}>
          {active
            ? `Set to ${place.label}, your saved place.`
            : "Showing Oklahoma City. Set your location on the Homepage to make it yours."}
        </p>
      )}
      <iframe
        key={src}
        className={s.preview}
        src={src.replace(SITE, "")}
        width={340}
        height={w.h}
        title={`${w.name} preview`}
        loading="lazy"
      />
      <label className={s.code}>
        <span>Copy this into your page</span>
        <textarea
          readOnly
          value={code}
          rows={4}
          onFocus={(e) => e.currentTarget.select()}
        />
      </label>
      <button
        type="button"
        className={s.copy}
        onClick={() =>
          navigator.clipboard?.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          })
        }
      >
        {copied ? "Copied" : "Copy code"}
      </button>
      <p className={s.note}>
        Free for any site. Please keep the StormSync Weather link in the widget.
        Data from NOAA (NWS, SPC) and Open-Meteo; refreshed every 10 minutes.
      </p>
    </section>
  );
}
