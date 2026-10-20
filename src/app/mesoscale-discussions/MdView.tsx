"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  CloudHail,
  ExternalLink,
  MapPin,
  Tornado,
  Wind,
} from "lucide-react";
import { usePlaces } from "@/features/location/usePlaces";
import { UsMap } from "@/features/maps/UsMap";
import type { Md } from "@/lib/spc/md";
import s from "./Md.module.css";

const HZ = {
  tornado: { label: "Tornado", icon: <Tornado aria-hidden /> },
  hail: { label: "Hail", icon: <CloudHail aria-hidden /> },
  wind: { label: "Wind", icon: <Wind aria-hidden /> },
};
const time = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

/** The watch-probability ring: a stroke drawn once, number counted in. */
function Ring({ prob }: { prob: number | null }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const v = prob ?? 0;
  const col =
    v >= 80 ? "#ff4d4d" : v >= 60 ? "#ff922b" : v >= 40 ? "#ffd43b" : "#69db7c";
  return (
    <div className={s.ring} style={{ ["--c" as string]: col }}>
      <svg viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} className={s.ringTrack} />
        {prob !== null && (
          <circle
            cx="32"
            cy="32"
            r={r}
            className={s.ringArc}
            strokeDasharray={`${(c * v) / 100} ${c}`}
          />
        )}
      </svg>
      <b>{prob === null ? "—" : `${prob}%`}</b>
    </div>
  );
}

function Card({ md, active, i }: { md: Md; active: boolean; i: number }) {
  const [open, setOpen] = useState(false);
  return (
    <article
      className={`${s.card} ${active ? s.live : s.old} ${md.here ? s.here : ""}`}
      style={{ ["--i" as string]: i }}
    >
      <header className={s.head}>
        <div className={s.title}>
          <span className={s.num}>MD {md.num}</span>
          <b>{md.concerning || "Severe weather potential"}</b>
          <span className={s.when}>
            {time(md.issue)} – {time(md.expire)} CT
            {!active && " · expired"}
          </span>
        </div>
        <Ring prob={md.prob} />
      </header>
      {md.here && (
        <p className={s.mine}>
          <MapPin aria-hidden /> Covers your place
        </p>
      )}
      {md.hazards.length > 0 && (
        <div className={s.hz}>
          {md.hazards.map((h) => (
            <span key={h}>
              {HZ[h].icon}
              {HZ[h].label}
            </span>
          ))}
        </div>
      )}
      <p className={s.read}>{md.read}</p>
      {md.areas && (
        <p className={s.areas}>
          <MapPin aria-hidden />
          {md.areas}
        </p>
      )}
      <button
        className={s.more}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? "Hide" : "Read"} the discussion
        <ChevronDown className={open ? s.chevOpen : undefined} aria-hidden />
      </button>
      {open && (
        <div className={s.body}>
          {md.summary && (
            <p>
              <b>Summary.</b> {md.summary}
            </p>
          )}
          {md.discussion && <p>{md.discussion}</p>}
          {md.text && !md.summary && <pre>{md.text}</pre>}
          <a
            href={`https://www.spc.noaa.gov/products/md/${md.year}/md${String(md.num).padStart(4, "0")}.html`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink aria-hidden /> Official MD on SPC
          </a>
        </div>
      )}
    </article>
  );
}

/** Live SPC mesoscale discussions on the national map, with cards. */
export function MdView({
  initial,
}: {
  initial: { active: boolean; mds: Md[] };
}) {
  const [data, setData] = useState(initial);
  const { active: place } = usePlaces();
  useEffect(() => {
    const load = () =>
      fetch(`/api/spc/md${place ? `?lat=${place.lat}&lon=${place.lon}` : ""}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setData(d))
        .catch(() => undefined);
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 120_000);
    return () => clearInterval(t);
  }, [place]);
  const { active, mds } = data;
  return (
    <div className="grid gap-4">
      <section className={active ? s.statusLive : s.status}>
        <i aria-hidden />
        <p>
          {active
            ? `${mds.length} active mesoscale discussion${mds.length === 1 ? "" : "s"}`
            : "No active mesoscale discussions. Showing the last three days."}
        </p>
      </section>
      <UsMap
        title={
          active
            ? "Active mesoscale discussions"
            : "Mesoscale discussions · last 3 days"
        }
        sub={null}
        legend={[
          active
            ? { label: "Active", color: "#ff922b" }
            : { label: "Expired", color: "#7c8098" },
        ]}
        status={mds.length ? "ready" : "empty"}
        file="sswx-mesoscale"
        zoomable
        overlay={
          <g>
            {mds.map((m) => (
              <g key={m.id} className={active ? s.mdLive : s.mdOld}>
                <path d={m.d} />
                {m.at && (
                  <text x={m.at.x} y={m.at.y}>
                    {m.num}
                  </text>
                )}
              </g>
            ))}
          </g>
        }
      />
      {mds.map((m, i) => (
        <Card key={m.id} md={m} active={active} i={i} />
      ))}
      <p className={s.muted}>
        SPC Mesoscale Discussions are short-fuse bulletins issued when severe
        convective weather is rapidly developing or imminent — typically 1–6
        hours before a tornado or severe thunderstorm watch. Each one shows the
        affected area, the probability a watch gets issued, the hazards in play,
        and a plain-language read of what it means for you.
      </p>
    </div>
  );
}
