"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CloudRain, MapPin, Sunrise, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LocationSheet } from "@/features/location/LocationSheet";
import { usePlaces } from "@/features/location/usePlaces";
import { briefText, timeIn, type Brief } from "@/lib/brief/compose";

/** Today's brief for the active place. */
export function BriefView({
  onTimeZone,
}: {
  onTimeZone?: (tz: string) => void;
}) {
  const { active } = usePlaces();
  const [sheet, setSheet] = useState(false);
  const [res, setRes] = useState<{
    key: string;
    brief?: Brief;
    error?: string;
  } | null>(null);
  const key = active?.id ?? "";

  useEffect(() => {
    if (!active) return;
    const ctl = new AbortController();
    fetch(`/api/brief?lat=${active.lat}&lon=${active.lon}`, {
      signal: ctl.signal,
    })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error ?? "The brief is unavailable");
        setRes({ key, brief: b });
        onTimeZone?.(b.timeZone);
      })
      .catch(
        (e: Error) =>
          e.name !== "AbortError" && setRes({ key, error: e.message }),
      );
    return () => ctl.abort();
  }, [active, key, onTimeZone]);

  const sheetEl = (
    <LocationSheet open={sheet} onClose={() => setSheet(false)} />
  );
  if (!active) {
    return (
      <Card className="grid gap-3">
        <p className="text-muted">Set a place to see its brief.</p>
        <Button variant="primary" onClick={() => setSheet(true)}>
          <MapPin className="size-4" aria-hidden /> Set location
        </Button>
        {sheetEl}
      </Card>
    );
  }
  const cur = res?.key === key ? res : null;
  const b = cur?.brief;
  const lines = b ? briefText(b).lines : [];
  return (
    <div className="grid gap-3">
      <button
        onClick={() => setSheet(true)}
        className="flex items-center gap-2 justify-self-start font-bold text-accent"
      >
        <MapPin className="size-4" aria-hidden /> {active.label}
      </button>
      {cur?.error && <Card className="text-muted">{cur.error}</Card>}
      {!cur && (
        <div
          className="h-48 animate-pulse rounded-2xl bg-surface"
          aria-label="Loading brief"
        />
      )}
      {b && (
        <>
          {b.alerts.length > 0 && (
            <Card className="grid gap-2 border-accent">
              {b.alerts.map((a) => (
                <p key={a.event + a.ends} className="flex gap-2 text-sm">
                  <AlertTriangle
                    className="mt-0.5 size-4 flex-none text-accent"
                    aria-hidden
                  />
                  <span>
                    <b className="text-accent">{a.event}</b>
                    {a.ends && (
                      <span className="text-muted">
                        {" "}
                        until {timeIn(a.ends, b.timeZone)}
                      </span>
                    )}
                  </span>
                </p>
              ))}
            </Card>
          )}
          {b.today && (
            <Card className="grid gap-1">
              <p className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted uppercase">
                <Sunrise className="size-4" aria-hidden /> {b.today.name}
              </p>
              <p className="text-lg font-bold">{b.today.short}</p>
              <p className="text-sm text-muted">{b.today.detail}</p>
            </Card>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Card className="grid gap-1">
              <p className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted uppercase">
                <CloudRain className="size-4" aria-hidden /> Rain
              </p>
              <p className="text-sm">{lines.find((l) => /rain/i.test(l))}</p>
            </Card>
            <Card className="grid gap-1">
              <p className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted uppercase">
                <Zap className="size-4" aria-hidden /> Severe
              </p>
              <p className="text-sm">{lines.find((l) => /SPC/.test(l))}</p>
            </Card>
          </div>
          {b.tomorrow && (
            <Card>
              <p className="text-xs font-bold tracking-wider text-muted uppercase">
                Tomorrow
              </p>
              <p className="mt-1">
                {b.tomorrow.short} · <b>{b.tomorrow.high ?? "–"}°</b> /{" "}
                {b.tomorrow.low ?? "–"}°
              </p>
            </Card>
          )}
          <p className="text-xs text-muted">
            AQI and pollen join the brief with their page (phase 23).
          </p>
        </>
      )}
      {sheetEl}
    </div>
  );
}
