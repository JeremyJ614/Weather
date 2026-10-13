"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { usePlaces } from "@/features/location/usePlaces";
import s from "./Con.module.css";

type Local = {
  cape: number;
  srh: number;
  shear: number;
  li: number;
  points: number;
};

const word = {
  cape: (v: number) =>
    v < 1000 ? "Weak" : v < 2500 ? "Moderate" : v < 4000 ? "Strong" : "Extreme",
  srh: (v: number) => (v < 150 ? "Low" : v < 300 ? "Notable" : "High"),
  shear: (v: number) => (v < 25 ? "Weak" : v < 40 ? "Moderate" : "Strong"),
  li: (v: number) =>
    v > 0
      ? "Stable"
      : v > -3
        ? "Marginal"
        : v > -6
          ? "Unstable"
          : "Very unstable",
};

/** "Your area": this hour's ingredients at the active saved place (not part of the national score). */
export function LocalCard() {
  const { active } = usePlaces();
  const key = active ? `${active.lat},${active.lon}` : null;
  const [res, setRes] = useState<{ key: string; data: Local | null } | null>(
    null,
  );
  useEffect(() => {
    if (!active) return;
    let live = true;
    fetch(`/api/sswxcon/local?lat=${active.lat}&lon=${active.lon}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (d) => live && setRes({ key: `${active.lat},${active.lon}`, data: d }),
      )
      .catch(
        () =>
          live && setRes({ key: `${active.lat},${active.lon}`, data: null }),
      );
    return () => {
      live = false;
    };
  }, [active]);
  if (!active)
    return (
      <p className={s.empty}>
        Save a place to see the storm ingredients where you are.
      </p>
    );
  const d = res?.key === key ? res.data : undefined;
  const rows: [string, string, string, string][] = d
    ? [
        ["CAPE", `${d.cape.toLocaleString()}`, "J/kg", word.cape(d.cape)],
        ["SRH 0–3 km", `${d.srh}`, "m²/s²", word.srh(d.srh)],
        ["Shear 0–6 km", `${d.shear}`, "kt", word.shear(d.shear)],
        ["Lifted index", `${d.li}`, "°C", word.li(d.li)],
      ]
    : [];
  return (
    <section className={s.local}>
      <header>
        <p className="eyebrow">
          <MapPin className="mr-1 inline size-3.5" aria-hidden /> Your area ·{" "}
          {active.label}
        </p>
        {d && (
          <b className={s.localPts}>
            {d.points}
            <small>/12</small>
          </b>
        )}
      </header>
      {d === undefined ? (
        <p className={s.muted}>Reading the model…</p>
      ) : d === null ? (
        <p className={s.muted}>
          The model feed isn&apos;t answering right now.
        </p>
      ) : (
        <ul>
          {rows.map(([k, v, u, w]) => (
            <li key={k}>
              <span>{k}</span>
              <b>
                {v} <small>{u}</small>
              </b>
              <em>{w}</em>
            </li>
          ))}
        </ul>
      )}
      <p className={s.muted}>
        This hour&apos;s storm ingredients for your place, from NOAA models via
        Open-Meteo. Shown beside the national score, not inside it.
      </p>
    </section>
  );
}
