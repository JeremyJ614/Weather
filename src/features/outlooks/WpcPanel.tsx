"use client";

import { useState } from "react";
import { CloudRain, Droplets, Flame, Sun } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { HomeTabs } from "@/features/news/HomeTabs";
import { UsMap } from "@/features/maps/UsMap";
import { Picker, Section } from "@/features/maps/Section";
import { Polys, useLayer } from "@/features/maps/useLayer";
import { ERO, QPF } from "@/lib/map/products";
import { HEATRISK_LEVELS } from "@/lib/weather/wpc";

const W = 975;
const H = 610;
const day = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

function Vector({
  ids,
  label,
}: {
  ids: { id: string; label: string }[];
  label: string;
}) {
  const [pick, setPick] = useState(ids[0].id);
  const { layer, status } = useLayer(pick);
  return (
    <>
      <Picker>
        {ids.map((q) => (
          <Chip
            key={q.id}
            pressed={q.id === pick}
            onClick={() => setPick(q.id)}
          >
            {q.label}
          </Chip>
        ))}
      </Picker>
      <UsMap
        title={layer?.title ?? label}
        sub={layer?.valid}
        legend={layer?.legend ?? []}
        status={status}
        file={`sswx-${pick}`}
      >
        {layer && <Polys polys={layer.polys} />}
      </UsMap>
    </>
  );
}

function Raster({
  src,
  title,
  sub,
  file,
}: {
  src: string;
  title: string;
  sub?: string;
  file: string;
}) {
  const [status, setStatus] = useState<{ src: string; ok: boolean } | null>(
    null,
  );
  const st = status?.src === src ? (status.ok ? "ready" : "error") : "loading";
  return (
    <UsMap
      title={title}
      sub={sub}
      legend={file === "sswx-heatrisk" ? HEATRISK_LEVELS : []}
      status={st}
      file={file}
    >
      <image
        key={src}
        href={src}
        width={W}
        height={H}
        preserveAspectRatio="none"
        opacity={0.85}
        onLoad={() => setStatus({ src, ok: true })}
        onError={() => setStatus({ src, ok: false })}
      />
    </UsMap>
  );
}

/** WPC subtab: rainfall totals, flood risk, HeatRisk and flash drought on static national maps. */
export function WpcPanel({ heatDays }: { heatDays: number[] }) {
  const [heatDay, setHeatDay] = useState(heatDays[0] ?? 0);
  const tabs = [
    {
      id: "wpc-qpf",
      label: "Rainfall Forecast",
      icon: <CloudRain aria-hidden />,
      panel: (
        <Section
          icon={<CloudRain aria-hidden />}
          eyebrow="Weather Prediction Center · QPF"
          title="Rainfall forecast"
          note="How much rain and melted snow WPC forecasters expect, in inches, for each day and as running totals. Warmer colors mean more water."
        >
          <Vector ids={QPF} label="Rainfall forecast" />
        </Section>
      ),
    },
    {
      id: "wpc-ero",
      label: "Excessive Rainfall Risk",
      icon: <Droplets aria-hidden />,
      panel: (
        <Section
          icon={<Droplets aria-hidden />}
          eyebrow="Weather Prediction Center · ERO"
          title="Excessive rainfall risk"
          note="The chance that rain falls fast enough to cause flash flooding within 25 miles of a point. Most flood deaths happen in Slight or Moderate risk areas, not just High. This is the flash-flood outlook from WPC, not the SPC severe-storm outlook; the two only share the risk names."
        >
          <Vector ids={ERO} label="Excessive rainfall risk" />
        </Section>
      ),
    },
    {
      id: "wpc-heat",
      label: "HeatRisk",
      icon: <Sun aria-hidden />,
      panel: (
        <Section
          icon={<Sun aria-hidden />}
          eyebrow="National Weather Service · HeatRisk"
          title="HeatRisk"
          note="How dangerous the heat is for health, from 0 (little risk) to 4 (extreme), judged against what is normal for that place and time of year."
        >
          {heatDays.length > 0 ? (
            <>
              <Picker>
                {heatDays.map((t) => (
                  <Chip
                    key={t}
                    pressed={t === heatDay}
                    onClick={() => setHeatDay(t)}
                  >
                    {day(t)}
                  </Chip>
                ))}
              </Picker>
              <Raster
                src={`/api/maps/raster?p=heat&t=${heatDay}`}
                title="HeatRisk"
                sub={day(heatDay)}
                file="sswx-heatrisk"
              />
            </>
          ) : (
            <p className="text-sm text-muted">
              The NWS HeatRisk service isn&apos;t answering right now.
            </p>
          )}
        </Section>
      ),
    },
    {
      id: "wpc-eddi",
      label: "Drought",
      icon: <Flame aria-hidden />,
      panel: (
        <Section
          icon={<Flame aria-hidden />}
          eyebrow="NOAA PSL · EDDI"
          title="Rapid drought onset"
          note="The Evaporative Demand Drought Index over two weeks: warm colors show thirsty air pulling water from the land faster than normal, an early sign of flash drought. Blues are wetter than normal."
        >
          <Raster
            src="/api/maps/raster?p=eddi"
            title="Evaporative Demand Drought Index (2 weeks)"
            file="sswx-eddi"
          />
        </Section>
      ),
    },
  ];
  return <HomeTabs tabs={tabs} label="WPC maps" variant="pills" />;
}
