"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ExternalLink,
  FileText,
  Globe2,
  MapPin,
  Radio,
  Sparkles,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LocationSheet } from "@/features/location/LocationSheet";
import { usePlaces } from "@/features/location/usePlaces";
import { HomeTabs } from "@/features/news/HomeTabs";
import { NewsBody } from "@/lib/news/markdown";
import { officeName, rawBlocks } from "@/lib/afd/raw";
import s from "./Discussion.module.css";

type Afd = { id: string; office: string; issued: string; text: string };
type Load<T> = { key: string; data?: T; error?: string; at?: number } | null;

const get = async <T,>(url: string, signal: AbortSignal): Promise<T> => {
  const r = await fetch(url, { signal });
  const b = await r.json();
  if (!r.ok) throw new Error(b.error ?? "Unavailable");
  return b as T;
};

const SIMPLE_ICONS = [Globe2, Sun, CalendarDays, AlertTriangle];

function Simplified({ office }: { office: string }) {
  const [st, setSt] = useState<Load<{ simplified: string }>>(null);
  useEffect(() => {
    const ctl = new AbortController();
    get<{ simplified: string }>(`/api/afd/simple?office=${office}`, ctl.signal)
      .then((data) => setSt({ key: office, data }))
      .catch(
        (e: Error) =>
          e.name !== "AbortError" && setSt({ key: office, error: e.message }),
      );
    return () => ctl.abort();
  }, [office]);
  const cur = st?.key === office ? st : null;
  if (!cur)
    return (
      <div className={s.writing} aria-label="Writing the simplified version">
        <Sparkles aria-hidden />
        <span>Translating the forecaster&apos;s notes…</span>
      </div>
    );
  if (cur.error) return <Card className="text-sm text-muted">{cur.error}</Card>;
  // One card per "## " section the model writes.
  const parts = cur
    .data!.simplified.split(/^## /m)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [title, ...rest] = x.split("\n");
      return { title: title.trim(), body: rest.join("\n").trim() };
    });
  return (
    <div className="grid gap-3">
      <p className={s.ai}>
        <Sparkles aria-hidden /> Plain-language version written by AI from the
        official discussion. The Standard tab is the source.
      </p>
      {parts.map((p, i) => {
        const Icon = SIMPLE_ICONS[i] ?? Sparkles;
        return (
          <section
            key={p.title}
            className={`${s.simple} ${i === parts.length - 1 ? s.watch : ""}`}
            style={{ ["--d" as string]: i }}
          >
            <h2>
              <span>
                <Icon aria-hidden />
              </span>
              {p.title}
            </h2>
            <div className={s.prose}>
              <NewsBody source={p.body} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Standard({ afd }: { afd: Afd }) {
  const blocks = rawBlocks(afd.text);
  const sections = blocks.filter((b) => b.kind === "section");
  return (
    <div className="grid gap-3">
      <nav className={s.jump} aria-label="Sections">
        {sections.map((b) => (
          <a key={b.title} href={`#afd-${b.title.replace(/\W+/g, "-")}`}>
            {b.title.split(" /")[0].toLowerCase()}
          </a>
        ))}
      </nav>
      {blocks.map((b, i) => (
        <section
          key={i}
          id={
            b.kind === "section"
              ? `afd-${b.title.replace(/\W+/g, "-")}`
              : undefined
          }
          className={`${s.raw} ${b.kind === "head" ? s.rawHead : ""} ${b.kind === "sign" ? s.rawSign : ""}`}
        >
          <pre>
            {b.lines.map((l, k) => (
              <span
                key={k}
                className={
                  k === 0 && b.kind === "section"
                    ? s.rawTitle
                    : l.trim() === "&&"
                      ? s.amp
                      : undefined
                }
              >
                {l}
                {"\n"}
              </span>
            ))}
          </pre>
        </section>
      ))}
    </div>
  );
}

/** Forecast Discussion from the active place's NWS office: Simplified (AI) and Standard (verbatim). */
export function Discussion() {
  const { active } = usePlaces();
  const [sheet, setSheet] = useState(false);
  const [state, setState] = useState<Load<Afd>>(null);
  const key = active?.id ?? "";

  useEffect(() => {
    if (!active) return;
    const ctl = new AbortController();
    get<{ place: { office: string } }>(
      `/api/weather?lat=${active.lat}&lon=${active.lon}`,
      ctl.signal,
    )
      .then((w) => get<Afd>(`/api/afd?office=${w.place.office}`, ctl.signal))
      .then((data) => setState({ key, data, at: Date.now() }))
      .catch(
        (e: Error) =>
          e.name !== "AbortError" && setState({ key, error: e.message }),
      );
    return () => ctl.abort();
  }, [active, key]);

  const sheetEl = (
    <LocationSheet open={sheet} onClose={() => setSheet(false)} />
  );
  if (!active) {
    return (
      <Card className="grid gap-3">
        <p className="text-sm text-muted">
          Set a place to read its local forecast discussion.
        </p>
        <Button variant="primary" onClick={() => setSheet(true)}>
          <MapPin className="size-4" aria-hidden /> Set location
        </Button>
        {sheetEl}
      </Card>
    );
  }
  const cur = state?.key === key ? state : null;
  const d = cur?.data;
  const ago = d
    ? Math.max(0, Math.round(((cur?.at ?? 0) - Date.parse(d.issued)) / 60000))
    : 0;
  return (
    <div className="grid gap-4">
      {!cur && <div className={s.skeleton} aria-label="Loading" />}
      {cur?.error && <Card className="text-sm text-muted">{cur.error}</Card>}
      {d && (
        <>
          <section className={s.office}>
            <span className={s.badge}>
              <Radio aria-hidden />
            </span>
            <div className={s.officeText}>
              <p className="eyebrow">NWS {d.office}</p>
              <h2>{officeName(d.text) ?? d.office}</h2>
              <button onClick={() => setSheet(true)} className={s.for}>
                <MapPin aria-hidden /> for {active.label}
              </button>
            </div>
            <div className={s.issued}>
              <b>
                {ago < 60
                  ? `${ago} min`
                  : `${Math.floor(ago / 60)} h ${ago % 60} m`}
              </b>
              <span>ago</span>
            </div>
          </section>
          <p className={s.meta}>
            Issued{" "}
            {new Date(d.issued).toLocaleString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {" · "}
            <a
              href={`https://forecast.weather.gov/product.php?site=NWS&issuedby=${d.office}&product=AFD`}
              target="_blank"
              rel="noreferrer"
            >
              Open on weather.gov <ExternalLink aria-hidden />
            </a>
          </p>
          <HomeTabs
            variant="segment"
            label="Discussion"
            tabs={[
              {
                id: "simple",
                label: "Simplified",
                icon: <Sparkles aria-hidden />,
                panel: <Simplified office={d.office} />,
              },
              {
                id: "standard",
                label: "Standard",
                icon: <FileText aria-hidden />,
                panel: <Standard afd={d} />,
              },
            ]}
          />
        </>
      )}
      {sheetEl}
    </div>
  );
}
