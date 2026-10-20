/* eslint-disable @next/next/no-img-element -- NHC's own graphics, shown as published */
"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import type { Storm } from "@/lib/tropical/nhc";
import t from "@/app/tropical-outlook/Tropical.module.css";
import s from "./Products.module.css";

const NHC = "https://www.nhc.noaa.gov/storm_graphics";

/** NHC's storm graphics; each is tried by its known file names, first that loads wins. */
const GRAPHICS = [
  {
    key: "cone",
    label: "Cone",
    blurb:
      "The probable track of the center over five days. The cone is not the storm's size: impacts reach well outside it.",
    names: [
      "5day_cone_with_line_and_wind.png",
      "5day_cone.png",
      "3day_cone.png",
    ],
  },
  {
    key: "wind",
    label: "Wind field",
    blurb:
      "How far tropical-storm and hurricane-force winds reach from the center now.",
    names: ["current_wind.png", "wind_history.png"],
  },
  {
    key: "probs",
    label: "Wind chances",
    blurb:
      "The chance of tropical-storm-force winds (39 mph or more) at each place within five days.",
    names: ["wind_probs_34_F120.png"],
  },
  {
    key: "arrival",
    label: "Arrival",
    blurb: "The most likely time tropical-storm-force winds arrive.",
    names: ["most_likely_toa_34.png", "3day_most_likely_toa_34.png"],
  },
  {
    key: "surge",
    label: "Peak surge",
    blurb:
      "Storm surge height above ground that has a 1-in-10 chance of being exceeded.",
    names: ["peak_surge.png"],
  },
  {
    key: "key",
    label: "Key messages",
    blurb: "NHC's headline points for this advisory.",
    names: ["key_messages.png"],
  },
] as const;

function Graphic({ id, names }: { id: string; names: readonly string[] }) {
  const atcf = id.toUpperCase();
  const urls = names.map((n) => `${NHC}/${atcf.slice(0, 4)}/${atcf}_${n}`);
  // Failures are tracked by address, so one image failing twice can't skip the next.
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const src = urls.find((u) => !failed.has(u));
  if (!src)
    return (
      <p className={t.empty}>
        NHC hasn&apos;t published this graphic for {atcf}. Not every product is
        made for every storm or basin.
      </p>
    );
  return (
    <>
      <img
        key={src}
        src={src}
        alt=""
        loading="lazy"
        className={s.graphic}
        onError={() => setFailed((f) => (f.has(src) ? f : new Set(f).add(src)))}
      />
      <a href={src} target="_blank" rel="noreferrer" className={s.small}>
        <Download aria-hidden /> Full size
      </a>
    </>
  );
}

/** The storm's official graphics from the National Hurricane Center. */
export function StormGraphics({ storm }: { storm: Storm }) {
  const [key, setKey] = useState<(typeof GRAPHICS)[number]["key"]>("cone");
  const g = GRAPHICS.find((x) => x.key === key)!;
  return (
    <section className={t.panel}>
      <header>
        <small>
          {storm.advisory ? `Advisory #${storm.advisory}` : "Official graphics"}
        </small>
        <h4>NHC graphics</h4>
      </header>
      <div className={s.pills} role="group" aria-label="Graphic">
        {GRAPHICS.map((x) => (
          <button
            key={x.key}
            type="button"
            aria-pressed={x.key === key}
            onClick={() => setKey(x.key)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <p className={s.blurb}>{g.blurb}</p>
      <Graphic key={`${storm.id}-${g.key}`} id={storm.id} names={g.names} />
      {storm.basin === "CP" && (
        <p className={s.blurb}>
          NHC doesn&apos;t publish model-track graphics for the Central Pacific;
          the Model Tracks tab draws the same guidance from the ATCF data.
        </p>
      )}
      {storm.links.graphics && (
        <a
          href={storm.links.graphics}
          target="_blank"
          rel="noreferrer"
          className={s.small}
        >
          <ExternalLink aria-hidden /> Every graphic on nhc.noaa.gov
        </a>
      )}
      <p className={s.source}>
        Official National Hurricane Center graphics, updated with each advisory
        (about every six hours).
      </p>
    </section>
  );
}

const PRODUCTS = [
  {
    key: "advisory",
    label: "Public",
    blurb:
      "The plain-language advisory: watches, warnings, hazards and where the storm is.",
  },
  {
    key: "forecast",
    label: "Forecast",
    blurb:
      "The technical forecast: center positions, wind radii by quadrant and forecast strength.",
  },
  {
    key: "discussion",
    label: "Discussion",
    blurb:
      "The forecaster's reasoning: how the models agree, how sure they are, and what could change.",
  },
  {
    key: "windProbs",
    label: "Wind chances",
    blurb:
      "The chance of tropical-storm, 58 mph and hurricane-force winds at each place.",
  },
] as const;

type Got = { url: string; text?: string; error?: string };

/** The storm's text products from the National Hurricane Center, verbatim. */
export function StormAdvisories({ storm }: { storm: Storm }) {
  const have = PRODUCTS.filter((p) => storm.links[p.key]);
  const [key, setKey] = useState(have[0]?.key);
  const url = key ? storm.links[key] : undefined;
  const [got, setGot] = useState<Got | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    fetch(`/api/tropical/advisory?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then(
        (d: { text?: string; error?: string }) =>
          live && setGot({ url, text: d.text, error: d.error }),
      )
      .catch(
        () =>
          live &&
          setGot({ url, error: "The advisory couldn't be loaded. Try again." }),
      );
    return () => {
      live = false;
    };
  }, [url]);
  if (!have.length || !url)
    return (
      <p className={t.empty}>
        No text products yet. They appear with the first advisory.
      </p>
    );
  const p = have.find((x) => x.key === key)!;
  const ready = got?.url === url ? got : null;
  return (
    <section className={t.panel}>
      <header>
        <small>
          {storm.advisory ? `Advisory #${storm.advisory}` : "NHC text"}
        </small>
        <h4>Advisories</h4>
      </header>
      <div className={s.pills} role="group" aria-label="Product">
        {have.map((x) => (
          <button
            key={x.key}
            type="button"
            aria-pressed={x.key === key}
            onClick={() => setKey(x.key)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <p className={s.blurb}>{p.blurb}</p>
      {!ready ? (
        <p className={t.empty}>Loading the {p.label.toLowerCase()} product…</p>
      ) : ready.error || !ready.text ? (
        <p className={t.empty}>
          {ready.error ?? "This product came back empty."}{" "}
          <a href={url} target="_blank" rel="noreferrer" className={s.link}>
            Read it on nhc.noaa.gov
          </a>
        </p>
      ) : (
        <pre className={s.pre}>{ready.text}</pre>
      )}
      <a href={url} target="_blank" rel="noreferrer" className={s.small}>
        <ExternalLink aria-hidden /> Open on nhc.noaa.gov
      </a>
      <p className={s.source}>
        Verbatim National Hurricane Center product. For life-safety decisions,
        follow nhc.noaa.gov and your local National Weather Service office.
      </p>
    </section>
  );
}
