"use client";

import { useEffect, useState } from "react";
import { MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LocationSheet } from "@/features/location/LocationSheet";
import { usePlaces } from "@/features/location/usePlaces";
import { HomeTabs } from "@/features/news/HomeTabs";
import { NewsBody } from "@/lib/news/markdown";
import type { AfdSection } from "@/lib/afd/parse";

type Afd = {
  id: string;
  office: string;
  issued: string;
  sections: AfdSection[];
};
type Load<T> = { key: string; data?: T; error?: string } | null;

const get = async <T,>(url: string, signal: AbortSignal): Promise<T> => {
  const r = await fetch(url, { signal });
  const b = await r.json();
  if (!r.ok) throw new Error(b.error ?? "Unavailable");
  return b as T;
};

function Simplified({ office }: { office: string }) {
  const [s, setS] = useState<Load<{ simplified: string }>>(null);
  useEffect(() => {
    const ctl = new AbortController();
    get<{ simplified: string }>(`/api/afd/simple?office=${office}`, ctl.signal)
      .then((data) => setS({ key: office, data }))
      .catch(
        (e: Error) =>
          e.name !== "AbortError" && setS({ key: office, error: e.message }),
      );
    return () => ctl.abort();
  }, [office]);
  const cur = s?.key === office ? s : null;
  if (!cur)
    return (
      <div
        className="h-60 animate-pulse rounded-2xl bg-surface"
        aria-label="Writing the simplified version"
      />
    );
  if (cur.error) return <Card className="text-muted">{cur.error}</Card>;
  return (
    <Card className="grid gap-3">
      <p className="flex items-center gap-2 text-xs text-muted">
        <Sparkles className="size-3.5 text-accent" aria-hidden /> Plain-language
        version written by AI from the official discussion. When in doubt, the
        Standard tab is the source.
      </p>
      <NewsBody source={cur.data!.simplified} />
    </Card>
  );
}

function Standard({ afd }: { afd: Afd }) {
  return (
    <div className="grid gap-3">
      {afd.sections.map((s) => (
        <Card key={s.title} className="grid gap-2">
          <h2 className="font-bold text-accent">{s.title}</h2>
          {s.paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted">
              {p}
            </p>
          ))}
        </Card>
      ))}
    </div>
  );
}

/** Forecast Discussion from the active place's NWS office: Simplified (AI) and Standard. */
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
      .then((data) => setState({ key, data }))
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
        <p className="text-muted">
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
  return (
    <div className="grid gap-4">
      <button
        onClick={() => setSheet(true)}
        className="flex items-center gap-2 justify-self-start font-bold text-accent"
      >
        <MapPin className="size-4" aria-hidden /> {active.label}
      </button>
      {!cur && (
        <div
          className="h-60 animate-pulse rounded-2xl bg-surface"
          aria-label="Loading"
        />
      )}
      {cur?.error && <Card className="text-muted">{cur.error}</Card>}
      {cur?.data && (
        <>
          <p className="mono text-xs text-muted">
            NWS {cur.data.office} · issued{" "}
            {new Date(cur.data.issued).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
          <HomeTabs
            variant="segment"
            tabs={[
              {
                id: "simple",
                label: "Simplified",
                panel: <Simplified office={cur.data.office} />,
              },
              {
                id: "standard",
                label: "Standard",
                panel: <Standard afd={cur.data} />,
              },
            ]}
          />
        </>
      )}
      {sheetEl}
    </div>
  );
}
