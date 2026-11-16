"use client";

import { useEffect, useRef, useState } from "react";
import {
  Cloud,
  CloudLightning,
  CloudRain,
  Flame,
  Layers,
  Snowflake,
  Thermometer,
  Tornado,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { CATEGORIES, type Category } from "@/lib/models/categories";
import s from "./Models.module.css";

const ICON: Record<Category, LucideIcon> = {
  "Radar & Storms": CloudLightning,
  Instability: Flame,
  "Wind & Shear": Wind,
  "Tornado & Hail Indices": Tornado,
  "Temperature & Moisture": Thermometer,
  "Rain & Flooding": CloudRain,
  Winter: Snowflake,
  "Upper Air": Layers,
  "Clouds & Sky": Cloud,
};

/**
 * The model field picker (owner, 2026-11-14: organized, not scattered): a rail of categories,
 * each with how many fields it holds, then that category's fields as a tidy grid. The rail opens
 * on the category of the field on screen.
 */
export function FieldPicker({
  params,
  value,
  onPick,
}: {
  params: { key: string; label: string; group: string; unit: string }[];
  value: string;
  onPick: (key: string) => void;
}) {
  const cats = CATEGORIES.filter((c) => params.some((p) => p.group === c));
  const current = params.find((p) => p.key === value);
  const [open, setOpen] = useState<string>(current?.group ?? cats[0]);
  const cat = cats.includes(open as Category) ? open : cats[0];
  // Keep the open category in view on the rail (it can sit past the edge on a phone).
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rail.current?.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );
    const box = rail.current;
    if (el && box)
      box.scrollLeft = Math.max(
        0,
        el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2,
      );
  }, [cat]);
  return (
    <section className={s.picker} aria-label="Map field">
      <header className={s.pickHead}>
        <small>Field</small>
        <b>{current?.label}</b>
      </header>
      <div
        ref={rail}
        className={s.cats}
        role="tablist"
        aria-label="Field categories"
      >
        {cats.map((c) => {
          const Icon = ICON[c];
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={c === cat}
              data-here={c === current?.group || undefined}
              onClick={() => setOpen(c)}
            >
              <Icon aria-hidden />
              {c}
              <b>{params.filter((p) => p.group === c).length}</b>
            </button>
          );
        })}
      </div>
      <div className={s.fields} role="tabpanel" aria-label={cat}>
        {params
          .filter((p) => p.group === cat)
          .map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={p.key === value}
              onClick={() => onPick(p.key)}
            >
              <span>{p.label}</span>
              {p.unit && p.unit.length <= 6 && <small>{p.unit}</small>}
            </button>
          ))}
      </div>
    </section>
  );
}
