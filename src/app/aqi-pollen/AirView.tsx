"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Flower2, MapPin, Wind } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LocationSheet } from "@/features/location/LazyLocationSheet";
import { usePlaces } from "@/features/location/usePlaces";
import { HomeTabs } from "@/features/news/HomeTabs";
import type { AirReport } from "@/lib/air/air";
import { AirTab } from "./AirTab";
import { PollenTab } from "./PollenTab";
import s from "./Air.module.css";

/** AQI & Pollen for the active place: Air Quality and Pollen & Allergy subtabs. */
export function AirView() {
  const { active } = usePlaces();
  const [sheet, setSheet] = useState(false);
  const [res, setRes] = useState<{
    key: string;
    air?: AirReport;
    error?: string;
    month?: number;
  } | null>(null);
  const key = active?.id ?? "";

  useEffect(() => {
    if (!active) return;
    const ctl = new AbortController();
    fetch(`/api/air?lat=${active.lat}&lon=${active.lon}`, {
      signal: ctl.signal,
    })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error ?? "Air quality is unavailable");
        setRes({ key, air: b, month: new Date().getMonth() + 1 });
      })
      .catch(
        (e: Error) =>
          e.name !== "AbortError" && setRes({ key, error: e.message }),
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
          Set a place to see its air quality and pollen.
        </p>
        <Button variant="primary" onClick={() => setSheet(true)}>
          <MapPin className="size-4" aria-hidden /> Set location
        </Button>
        {sheetEl}
      </Card>
    );
  }
  const cur = res?.key === key ? res : null;
  return (
    <div className="grid gap-4">
      <button onClick={() => setSheet(true)} className={s.place}>
        <MapPin aria-hidden /> {active.label}
        <ChevronDown aria-hidden />
      </button>
      {!cur && <div className={s.skeleton} aria-label="Loading" />}
      {cur?.error && <Card className="text-sm text-muted">{cur.error}</Card>}
      {cur?.air && (
        <HomeTabs
          variant="segment"
          label="Air"
          tabs={[
            {
              id: "aqi",
              label: "Air Quality",
              icon: <Wind aria-hidden />,
              panel: cur.air.aqi ? (
                <AirTab aqi={cur.air.aqi} />
              ) : (
                <Card className="text-sm text-muted">
                  No air-quality reading for this place right now.
                </Card>
              ),
            },
            {
              id: "pollen",
              label: "Pollen & Allergy",
              icon: <Flower2 aria-hidden />,
              panel: (
                <PollenTab pollen={cur.air.pollen} month={cur.month ?? 1} />
              ),
            },
          ]}
        />
      )}
      {sheetEl}
    </div>
  );
}
