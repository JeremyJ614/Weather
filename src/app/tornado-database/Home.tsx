"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePlaces } from "@/features/location/usePlaces";
import type { Colors } from "@/lib/colors/pick";
import { pick } from "@/lib/colors/pick";
import { EF_COLORS } from "@/lib/colors/ef";
import { Search, whereIs } from "./Search";
import s from "./Tornado.module.css";

const UsMap = dynamic(
  () => import("@/features/maps/UsMap").then((m) => m.UsMap),
  { ssr: false, loading: () => <div className={s.mapWait} /> },
);

type Track = {
  d: string;
  ef: string;
  date: string;
  st: string;
  miles: number;
  deaths: number;
};
type View = { x: number; y: number; w: number };
type Pick = { slug: string; label: string; n: number; top: number };
const EF = ["EFU", "EF0", "EF1", "EF2", "EF3", "EF4", "EF5"];

/**
 * The Tornado Database's front page: the region around the saved place, with every surveyed
 * tornado path of the last two years in that state only, then the search, then counties to
 * open (owner's Weather list #42, item 2).
 */
export function TornadoHome({
  colors,
  views,
  famous,
  year,
}: {
  colors: Colors;
  views: Record<string, View>;
  famous: Pick[];
  year: number;
}) {
  const { active } = usePlaces();
  const [st, setSt] = useState<string | null>(null);
  const [mine, setMine] = useState<Pick | null>(null);
  const [busiest, setBusiest] = useState<Pick[]>([]);
  const [tracks, setTracks] = useState<Track[] | null | "error">(null);
  const c = (ef: string) => pick(colors, `ef:${ef}`, EF_COLORS[ef]);
  const from = `${year - 1}-01-01`;
  const to = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!active) return;
    let off = false;
    whereIs(active.lat, active.lon).then((r) => {
      if (off || !r?.county) return;
      setSt(r.county.st);
      setMine(r.county);
      setBusiest(r.busiest ?? []);
    });
    return () => {
      off = true;
    };
  }, [active]);

  useEffect(() => {
    let off = false;
    fetch(`/api/history/tornadoes?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { tracks: Track[] }) => !off && setTracks(j.tracks))
      .catch(() => !off && setTracks("error"));
    return () => {
      off = true;
    };
  }, [from, to]);

  // The state's own outline, lit, so the eye finds it in the region.
  const [outline, setOutline] = useState<string | null>(null);
  useEffect(() => {
    if (!st) return;
    let off = false;
    fetch("/api/maps/base")
      .then((r) => r.json())
      .then((b: { states: { id: string; d: string }[] }) => {
        if (!off) setOutline(b.states.find((x) => x.id === st)?.d ?? null);
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [st]);
  const mineTracks = useMemo(
    () =>
      Array.isArray(tracks) && st ? tracks.filter((t) => t.st === st) : [],
    [tracks, st],
  );
  const counts = EF.map((ef) => ({
    ef,
    n: mineTracks.filter((t) => t.ef === ef).length,
  })).filter((x) => x.n);
  const status = !st
    ? "empty"
    : tracks === null
      ? "loading"
      : tracks === "error"
        ? "error"
        : mineTracks.length
          ? "ready"
          : "empty";
  const view = st ? views[st] : undefined;
  const strong = mineTracks.filter((t) =>
    ["EF3", "EF4", "EF5"].includes(t.ef),
  ).length;
  const deaths = mineTracks.reduce((a, t) => a + t.deaths, 0);

  return (
    <div className={s.page}>
      <section className={s.region}>
        <div className={s.rHead}>
          <p className={s.eye}>
            {st ? `${st} · ${year - 1} and ${year}` : `${year - 1} and ${year}`}
          </p>
          <h2>
            {st
              ? `Tornado paths in ${stateName(st)} since January ${year - 1}`
              : "Tornado paths near you"}
          </h2>
          {st && Array.isArray(tracks) && (
            <p className={s.lead}>
              {mineTracks.length.toLocaleString("en-US")} surveyed tornado
              {mineTracks.length === 1 ? "" : "es"}
              {strong ? `, ${strong} rated EF3 or stronger` : ""}
              {deaths ? `, ${deaths} ${deaths === 1 ? "death" : "deaths"}` : ""}
              . Only your state&apos;s paths are drawn; the map shows the region
              around it.
            </p>
          )}
          {!active && (
            <p className={s.lead}>
              Set your location (the pin at the top of the page) and this map
              frames your region with your state&apos;s tornado paths from the
              last two years.
            </p>
          )}
        </div>
        <UsMap
          key={st ?? "us"}
          title={
            st ? `Tornado paths · ${st} · ${year - 1}–${year}` : "Tornado paths"
          }
          sub={st ? "NWS damage surveys" : null}
          legend={(counts.length ? counts : EF.map((ef) => ({ ef, n: 0 }))).map(
            ({ ef, n }) => ({ label: n ? `${ef} · ${n}` : ef, color: c(ef) }),
          )}
          status={status}
          file={`sswx-tornado-paths-${st ?? "us"}-${year}`}
          view={view}
          maxZoom={40}
          overlay={
            outline ? (
              <path
                d={outline}
                className={s.mine}
                vectorEffect="non-scaling-stroke"
              />
            ) : null
          }
          towns
        >
          {EF.map((ef, k) => (
            <g
              key={ef}
              className={s.rTracks}
              stroke={c(ef)}
              style={{
                ["--cw" as string]: 1.1 + k * 0.5,
                ["--sw" as string]: 1.8 + k * 0.4,
              }}
            >
              {mineTracks
                .filter((t) => t.ef === ef)
                .map((t, i) => (
                  <path key={i} d={t.d} />
                ))}
            </g>
          ))}
        </UsMap>
      </section>
      <section className={s.card}>
        <Search colors={colors} />
      </section>
      {mine && (
        <section className={s.card}>
          <p className={s.eye}>Your state</p>
          <h2>Open a county</h2>
          <ul className={s.picks}>
            {[mine, ...busiest].map((p) => (
              <PickCard key={p.slug} p={p} c={c} />
            ))}
          </ul>
        </section>
      )}
      <section className={s.card}>
        <p className={s.eye}>Famous tornado country</p>
        <h2>Counties with a story</h2>
        <ul className={s.picks}>
          {famous.map((p) => (
            <PickCard key={p.slug} p={p} c={c} />
          ))}
        </ul>
      </section>
      <p className={s.source}>
        Map: NWS Damage Assessment Toolkit surveys for {year - 1} and {year}{" "}
        (this year&apos;s are preliminary). County pages: NOAA Storm Prediction
        Center&apos;s tornado record since 1950.
      </p>
    </div>
  );
}

function PickCard({ p, c }: { p: Pick; c: (ef: string) => string }) {
  const ef = p.top === -2 ? "" : p.top < 0 ? "EFU" : `EF${p.top}`;
  return (
    <li>
      <Link
        href={`/tornado-database/${p.slug}`}
        style={{ ["--c" as string]: ef ? c(ef) : undefined }}
      >
        <span>
          <b>{p.label}</b>
          <small>
            {p.n
              ? `${p.n.toLocaleString("en-US")} tornadoes since 1950`
              : "No tornadoes since 1950"}
          </small>
        </span>
        {ef && <em className={s.rate}>{ef === "EFU" ? "U" : ef}</em>}
        <i aria-hidden>→</i>
      </Link>
    </li>
  );
}

const NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "Washington, DC",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  PR: "Puerto Rico",
};
const stateName = (st: string) => NAMES[st] ?? st;
