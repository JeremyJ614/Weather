"use client";

import { useEffect, useMemo, useState } from "react";
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import { pick, type Colors } from "@/lib/colors/pick";
import { COAST_BANDS, TOA_BANDS } from "@/lib/engines/colors";
import { read as readPlaces } from "@/features/location/store";
import type { Coastal, CoastStorm } from "@/lib/tropical/coastal";
import s from "./Engines.module.css";

const FT = [3, 6, 9] as const;
type Ft = (typeof FT)[number];
const bin = (lo: number) =>
  Math.max(
    0,
    COAST_BANDS.findLastIndex((b) => lo >= b.min),
  );
const hoursBin = (h: number) => TOA_BANDS.findIndex((b) => h < b.max);
const when = (ms: number) =>
  new Date(ms).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

/** The surge chance bin at a spot: the nearest square within ~2 miles, else none. */
function chanceAt(st: CoastStorm, ft: Ft, lat: number, lon: number) {
  let best: [number, number, number, number] | null = null;
  let bd = 0.035;
  for (const c of st.surge[ft] ?? []) {
    const d = Math.hypot(
      c[0] - lat,
      (c[1] - lon) * Math.cos((lat * Math.PI) / 180),
    );
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}
/** Tropical-storm wind arrival at a spot from NHC's half-degree grid (nearest cell). */
function arrivalAt(st: CoastStorm, lat: number, lon: number) {
  const step = st.toa?.step ?? 0.5;
  let best: [number, number, number, number] | null = null;
  let bd = step * 0.75;
  for (const c of st.toa?.cells ?? []) {
    const d = Math.hypot(c[0] - lat, c[1] - lon);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

/**
 * Coastal Impact (Extras → Weather Engines, post-launch A7): NHC's P-Surge odds of more than 3,
 * 6 or 9 feet of surge drawn on the map with the arrival of tropical-storm winds, the coast's
 * worst stretches and the member's saved places. Active only while NHC runs these for a U.S.
 * threat; otherwise an honest notice and a labeled example (Helene, 2024).
 */
export default function CoastPanel({
  map,
  colors,
}: {
  map: MaplibreMap | null;
  colors: Colors | undefined;
}) {
  const [example, setExample] = useState(false);
  const [got, setGot] = useState<{
    ex: boolean;
    d: Coastal | "error";
  } | null>(null);
  const [ft, setFt] = useState<Ft>(3);
  const [storm, setStorm] = useState(0);
  useEffect(() => {
    let live = true;
    fetch(`/api/engines/coast${example ? "?example=1" : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Coastal) => live && setGot({ ex: example, d }))
      .catch(() => live && setGot({ ex: example, d: "error" }));
    return () => {
      live = false;
    };
  }, [example]);
  const data = got?.ex === example ? got.d : null;
  const st =
    data && data !== "error" ? (data.storms[storm] ?? data.storms[0]) : null;
  // Arrival hours count from the data time (now for live data, the advisory for the example).
  const base = data && data !== "error" ? Date.parse(data.at) : 0;
  const coastColor = (i: number) =>
    pick(colors, `engine:coast:${i}`, COAST_BANDS[i].color);
  const toaColor = (i: number) =>
    pick(colors, `engine:toa:${i}`, TOA_BANDS[i].color);

  // Map layers: arrival squares under the surge squares; removed when the panel closes.
  useEffect(() => {
    if (!map) return;
    const empty = { type: "FeatureCollection", features: [] } as never;
    if (!map.getSource("coastT")) {
      map.addSource("coastT", { type: "geojson", data: empty });
      map.addSource("coastS", { type: "geojson", data: empty });
      map.addLayer({
        id: "coastT",
        type: "fill",
        source: "coastT",
        paint: {
          "fill-color": ["get", "c"],
          "fill-opacity": 0.28,
          "fill-outline-color": "rgba(0,0,0,0)",
        },
      });
      map.addLayer({
        id: "coastS",
        type: "circle",
        source: "coastS",
        paint: {
          "circle-color": ["get", "c"],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            1.6,
            7,
            4,
            10,
            10,
          ],
          "circle-opacity": 0.92,
        },
      });
    }
    return () => {
      for (const id of ["coastS", "coastT"]) {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
      }
    };
  }, [map]);

  useEffect(() => {
    if (!map || !map.getSource("coastS")) return;
    const cells = st?.surge[ft] ?? [];
    (map.getSource("coastS") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: cells
        .filter((c) => c[2] >= 5)
        .map((c) => ({
          type: "Feature",
          properties: { c: coastColor(bin(c[2])) },
          geometry: { type: "Point", coordinates: [c[1], c[0]] },
        })),
    });
    const h = (st?.toa?.step ?? 0.5) / 2;
    (map.getSource("coastT") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: (st?.toa?.cells ?? []).map((c) => ({
        type: "Feature",
        properties: {
          c: toaColor(Math.max(0, hoursBin((c[3] - base) / 3600_000))),
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [c[1] - h, c[0] - h],
              [c[1] + h, c[0] - h],
              [c[1] + h, c[0] + h],
              [c[1] - h, c[0] + h],
              [c[1] - h, c[0] - h],
            ],
          ],
        },
      })),
    });
    const all = [...(st?.surge[3] ?? []), ...(st?.toa?.cells ?? [])];
    if (all.length) {
      const lats = all.map((c) => c[0]);
      const lons = all.map((c) => c[1]);
      map.fitBounds(
        [
          [Math.min(...lons) - 1, Math.min(...lats) - 1],
          [Math.max(...lons) + 1, Math.max(...lats) + 1],
        ],
        { duration: 900, maxZoom: 7 },
      );
    }
  }, [map, st, ft]); // eslint-disable-line react-hooks/exhaustive-deps -- colors read per render

  const places = useMemo(() => {
    try {
      return readPlaces().list;
    } catch {
      return [];
    }
  }, []);

  return (
    <>
      <section className={s.card}>
        <header>
          <h3>{st ? st.name : "Coastal Impact"}</h3>
          {st?.run && (
            <small>
              {data !== "error" && data?.example ? "Example · " : ""}P-Surge{" "}
              {st.run.slice(4, 6)}/{st.run.slice(6, 8)} {st.run.slice(8)}Z run
            </small>
          )}
        </header>
        {data === "error" && (
          <p className={s.small}>
            The National Hurricane Center isn&apos;t answering right now.
          </p>
        )}
        {!data && (
          <p className={s.small}>Reading NHC&apos;s surge and wind files…</p>
        )}
        {data && data !== "error" && !data.storms.length && (
          <>
            <p className={s.small}>
              No hurricane or tropical storm is threatening the U.S. right now,
              so NHC isn&apos;t running surge odds or wind arrival times. This
              turns on by itself when it does.
            </p>
            <button
              type="button"
              className={s.textBtn}
              onClick={() => setExample(true)}
            >
              Show an example: Hurricane Helene, Sept. 25, 2024
            </button>
          </>
        )}
        {data && data !== "error" && data.example && (
          <p className={s.small}>
            Example from the past, not today&apos;s weather: NHC&apos;s files
            the evening before Helene made landfall in Florida&apos;s Big Bend.{" "}
            <button
              type="button"
              className={s.textBtn}
              onClick={() => setExample(false)}
            >
              Back to now
            </button>
          </p>
        )}
        {data && data !== "error" && data.storms.length > 1 && (
          <div className={s.windows} role="group" aria-label="Storm">
            {data.storms.map((x, i) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={i === storm}
                onClick={() => setStorm(i)}
              >
                {x.name}
              </button>
            ))}
          </div>
        )}
        {st && (
          <>
            <div className={s.windows} role="group" aria-label="Surge height">
              {FT.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={f === ft}
                  onClick={() => setFt(f)}
                >
                  More than {f} ft
                </button>
              ))}
            </div>
            <p className={s.small}>
              Dots: the chance of more than {ft} feet of surge above the ground
              {st.run ? "" : " (no surge odds in this advisory)"}. Shaded
              squares: when tropical-storm winds most likely arrive, counted
              from {data !== "error" && data?.example ? "the advisory" : "now"}.
            </p>
            <ul className={s.legendRow}>
              {TOA_BANDS.map((b, i) => (
                <li key={b.label}>
                  <i style={{ background: toaColor(i) }} />
                  {b.label}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {st && st.stretches.length > 0 && (
        <section className={s.card}>
          <header>
            <h3>Coast most at risk</h3>
            <small>more than 3 / 6 / 9 ft</small>
          </header>
          <ul className={s.storms}>
            {st.stretches.map((x) => (
              <li key={`${x.lat},${x.lon}`}>
                <button
                  type="button"
                  onClick={() =>
                    map?.flyTo({
                      center: [x.lon, x.lat],
                      zoom: 8.5,
                      duration: 1200,
                    })
                  }
                >
                  <span className={s.where}>
                    <b>{x.place}</b>
                    <small>
                      {x.arrive
                        ? `Tropical-storm winds most likely by ${when(x.arrive)}`
                        : "No arrival time here"}
                    </small>
                  </span>
                  <span className={s.chips}>
                    {x.p.map((p, i) => (
                      <b
                        key={FT[i]}
                        style={{
                          borderColor: p ? coastColor(bin(p)) : undefined,
                        }}
                      >
                        {p ? `${p}%+` : "<5%"}
                      </b>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {st && (
        <section className={s.card}>
          <header>
            <h3>Your places</h3>
          </header>
          {!places.length && (
            <p className={s.small}>
              Save a place on the Homepage to see its surge odds and how long
              you have to finish preparing.
            </p>
          )}
          <ul className={s.storms}>
            {places.map((p) => {
              const a = arrivalAt(st, p.lat, p.lon);
              const odds = FT.map((f) => chanceAt(st, f, p.lat, p.lon));
              const left = a ? (a[3] - base) / 3600_000 : null;
              return (
                <li key={p.id}>
                  <div className={s.placeRow}>
                    <span className={s.where}>
                      <b>{p.label}</b>
                      <small>
                        {a
                          ? `Tropical-storm winds: earliest reasonable ${when(a[2])}, most likely ${when(a[3])}${left !== null && left > 0 ? ` (about ${Math.round(left)} h to finish preparing)` : ""}`
                          : "Tropical-storm winds aren't expected here."}
                      </small>
                      <small>
                        {odds.some(Boolean)
                          ? odds
                              .map((o, i) =>
                                o
                                  ? `>${FT[i]} ft: ${o[2]}–${o[3]}%`
                                  : `>${FT[i]} ft: under 1%`,
                              )
                              .join(" · ")
                          : "Not in NHC's surge area (inland, or no surge expected)."}
                      </small>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
