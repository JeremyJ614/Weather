"use client";

import { useState } from "react";
import { Camera, Check, MapPin, Star } from "lucide-react";
import { read as readPlaces } from "@/features/location/store";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { SPECIES, type SpeciesId } from "@/lib/engines/outdoor";
import { sendReport, type ReportKind } from "./report-actions";
import s from "./Engines.module.css";

export type Summary = {
  days: number;
  total: number;
  by: { from: number; n: number; avg: number | null }[];
} | null;

export type PlaceData = {
  at: string;
  hours: { t: number; v: number }[];
  best: { day: string; from: string; v: number }[];
  now: number;
  season?: string[];
  next?: { name: string; start: string } | null;
  state?: string;
  rut?: number;
  legal?: { from: string; to: string } | null;
  stand?: string;
  colder?: number;
  trend?: string;
  front?: string | null;
  frontDay?: string | null;
  water?: { f: number; from: string };
  majors?: string[];
  minors?: string[];
  species?: string;
};

const RUT = (b: number) =>
  b >= 1.5 ? "peak rut" : b >= 1.25 ? "pre-rut" : b > 1 ? "post-rut" : "";
const date = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** One place's next three days for Deer Activity or Fishing Bite. */
export function PlacePanel({
  kind,
  label,
  data,
  color,
}: {
  kind: "deer" | "fish";
  label: string;
  data: PlaceData | "error" | null;
  color: (v: number) => string;
}) {
  if (data === null) return <p className={s.small}>Reading the forecast…</p>;
  if (data === "error")
    return (
      <p className={s.small}>
        The forecast isn&apos;t answering for this place right now. Try again in
        a few minutes.
      </p>
    );
  const W = 288;
  const H = 70;
  const bw = W / data.hours.length;
  return (
    <div className="grid gap-3">
      <p className={s.readout}>
        <b style={{ color: color(data.now) }}>{data.now}</b>
        <span>
          {kind === "deer" ? "deer activity" : `${data.species} bite`} now near{" "}
          {label}
        </span>
      </p>
      <svg
        viewBox={`0 0 ${W} ${H + 14}`}
        className={s.chart}
        role="img"
        aria-label="The next three days, hour by hour"
      >
        {data.hours.map((h, i) => (
          <rect
            key={h.t}
            x={i * bw}
            y={H - (h.v / 100) * H}
            width={Math.max(1, bw - 0.6)}
            height={(h.v / 100) * H}
            fill={color(h.v)}
          >
            <title>{`${new Date(h.t).toLocaleString("en-US", { weekday: "short", hour: "numeric" })}: ${h.v}`}</title>
          </rect>
        ))}
        {[0, 24, 48].map((k) =>
          data.hours[k] ? (
            <text key={k} x={k * bw + 1} y={H + 12} className={s.axis}>
              {new Date(data.hours[k].t).toLocaleDateString("en-US", {
                weekday: "short",
              })}
            </text>
          ) : null,
        )}
      </svg>
      {data.best.length > 0 && (
        <p className={s.small}>
          <b>Best times:</b>{" "}
          {data.best.map((b) => `${b.day} ${b.from} (${b.v})`).join(" · ")}
        </p>
      )}
      {kind === "deer" && (
        <ul className={s.facts}>
          <li>
            <b>Season today:</b>{" "}
            {data.season?.length
              ? data.season.join(", ")
              : data.next
                ? `none; ${data.next.name} opens ${date(data.next.start)}`
                : "none listed"}{" "}
            ({data.state})
          </li>
          {data.legal && (
            <li>
              <b>Legal shooting hours today:</b> {data.legal.from} to{" "}
              {data.legal.to}
            </li>
          )}
          {data.stand && <li>{data.stand}</li>}
          {data.colder != null && (
            <li>
              {data.colder > 2
                ? `${data.colder}°F colder than the past week: deer tend to move more.`
                : data.colder < -2
                  ? `${-data.colder}°F warmer than the past week: expect less daytime movement.`
                  : "About as warm as the past week."}
              {data.rut && RUT(data.rut) ? ` It's the ${RUT(data.rut)}.` : ""}
            </li>
          )}
          <li className={s.fine}>
            Always check the state&apos;s hunting regulations; the season dates
            here are kept by StormSync.
          </li>
        </ul>
      )}
      {kind === "fish" && (
        <ul className={s.facts}>
          <li>
            <b>Pressure:</b> {data.trend}
            {data.front
              ? `; a front looks to pass about ${data.front} ${data.frontDay}`
              : ""}
          </li>
          {!!data.majors?.length && (
            <li>
              <b>Major periods:</b> {data.majors.join(", ")}
            </li>
          )}
          {!!data.minors?.length && (
            <li>
              <b>Minor periods:</b> {data.minors.join(", ")}
            </li>
          )}
          {data.water && (
            <li>
              <b>Water:</b> {data.water.f}°F, {data.water.from}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export function SpeciesPicker({
  value,
  onChange,
}: {
  value: SpeciesId;
  onChange: (v: SpeciesId) => void;
}) {
  return (
    <div className={s.windows} role="group" aria-label="Species">
      {SPECIES.map((x) => (
        <button
          key={x.id}
          type="button"
          aria-pressed={value === x.id}
          onClick={() => onChange(x.id)}
        >
          {x.name.replace(/^(Largemouth|Channel) (.)/, (_, _w, c: string) =>
            c.toUpperCase(),
          )}
        </button>
      ))}
    </div>
  );
}

/** How members' reports line up with what the engine said there. */
export function ReportSummary({
  kind,
  sum,
}: {
  kind: ReportKind;
  sum: Summary;
}) {
  if (!sum) return null;
  if (sum.total < 5)
    return (
      <p className={s.small}>
        Members&apos; reports tune this engine. {sum.total} so far in the last{" "}
        {sum.days} days; the comparison shows once there are 5.
      </p>
    );
  if (kind === "rainbow") {
    const scored = sum.by.reduce((a, b) => a + b.n, 0);
    const caught = sum.by
      .filter((b) => b.from >= 20)
      .reduce((a, b) => a + b.n, 0);
    return (
      <p className={s.small}>
        Members reported {sum.total} rainbows in the last {sum.days} days;{" "}
        {scored ? Math.round((100 * caught) / scored) : 0}% were where we showed
        a chance.
      </p>
    );
  }
  const unit =
    kind === "sunset" ? "stars" : kind === "fish" ? "fish caught" : "deer seen";
  return (
    <p className={s.small}>
      Members&apos; reports, last {sum.days} days ({sum.total}):{" "}
      {sum.by
        .filter((b) => b.n)
        .map((b) => `scored ${b.from}+: ${b.avg} ${unit} on average`)
        .join(" · ")}
      .
    </p>
  );
}

/** Shrinks a photo in the browser to at most 1280 px, as JPEG. */
async function shrink(file: File) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise<Blob>((ok, no) =>
    c.toBlob((b) => (b ? ok(b) : no(new Error("photo"))), "image/jpeg", 0.8),
  );
}

const ASK: Record<ReportKind, string> = {
  rainbow: "Seeing a rainbow? Tell us",
  sunset: "Rate tonight's sunset",
  fish: "Log a catch",
  deer: "Log deer you saw",
};

/** A member's report for an outdoor engine, from where they are now, with an optional photo. */
export function ReportBox({
  kind,
  species,
}: {
  kind: ReportKind;
  species?: string;
}) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(kind === "sunset" ? 0 : 1);
  const [detail, setDetail] = useState(kind === "deer" ? "both" : "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  const where = () =>
    new Promise<{ lat: number; lon: number }>((ok, no) => {
      const fallback = () => {
        const p = readPlaces();
        const a = p.list.find((x) => x.id === p.active) ?? p.list[0];
        if (a) ok({ lat: a.lat, lon: a.lon });
        else no(new Error("place"));
      };
      if (!navigator.geolocation) return fallback();
      navigator.geolocation.getCurrentPosition(
        (pos) => ok({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        fallback,
        { timeout: 8000, maximumAge: 600_000 },
      );
    });

  const send = async () => {
    if (kind === "sunset" && !n) return setError("Pick 1 to 5 stars.");
    setState("busy");
    setError("");
    try {
      const at = await where().catch(() => null);
      if (!at) {
        setState("idle");
        return setError(
          "We need your location (or a saved place) to place the report.",
        );
      }
      let path: string | null = null;
      if (photo) {
        const sb = supabaseBrowser();
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user) {
          setState("idle");
          return setError("Sign in to send a photo.");
        }
        path = `${user.id}/${Date.now()}.jpg`;
        const { error: up } = await sb.storage
          .from("outdoor")
          .upload(path, await shrink(photo), { contentType: "image/jpeg" });
        if (up) path = null;
      }
      const r = await sendReport({
        kind,
        ...at,
        rating: kind === "rainbow" ? null : n,
        detail: kind === "fish" ? (species ?? "") : detail,
        photo: path,
      });
      if ("error" in r) {
        setState("idle");
        return setError(r.error);
      }
      setState("done");
    } catch {
      setState("idle");
      setError("That didn't go through. Try again.");
    }
  };

  if (state === "done")
    return (
      <p className={s.small}>
        <Check aria-hidden className="inline w-4" /> Thanks! Your report helps
        tune this engine.
      </p>
    );
  if (!open)
    return (
      <button type="button" className={s.ask} onClick={() => setOpen(true)}>
        <MapPin aria-hidden /> {ASK[kind]}
      </button>
    );
  return (
    <section className={s.card}>
      <header>
        <h3>{ASK[kind]}</h3>
        <small>From where you are now</small>
      </header>
      {kind === "sunset" && (
        <div className={s.stars} role="group" aria-label="Stars">
          {[1, 2, 3, 4, 5].map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={n >= k}
              aria-label={`${k} star${k > 1 ? "s" : ""}`}
              onClick={() => setN(k)}
            >
              <Star aria-hidden />
            </button>
          ))}
        </div>
      )}
      {(kind === "fish" || kind === "deer") && (
        <label className={s.field}>
          <span>{kind === "fish" ? "How many caught" : "How many deer"}</span>
          <input
            type="number"
            min={0}
            max={99}
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
          />
        </label>
      )}
      {kind === "deer" && (
        <div className={s.windows} role="group" aria-label="Which">
          {["bucks", "does", "both"].map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={detail === d}
              onClick={() => setDetail(d)}
            >
              {d}
            </button>
          ))}
        </div>
      )}
      <label className={s.photo}>
        <Camera aria-hidden />
        <span>{photo ? photo.name : "Add a photo (optional)"}</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
      </label>
      {error && <p className={s.small}>{error}</p>}
      <button
        type="button"
        className={s.ask}
        disabled={state === "busy"}
        onClick={send}
      >
        {state === "busy" ? "Sending…" : "Send"}
      </button>
    </section>
  );
}
