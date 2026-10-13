"use client";

import { useState, type ReactNode } from "react";

/** Homepage tabs. Every panel is rendered on the server; switching only shows another. */
export function HomeTabs({
  tabs,
}: {
  tabs: { id: string; label: string; panel: ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  const index = Math.max(
    0,
    tabs.findIndex((t) => t.id === active),
  );
  return (
    <div className="grid gap-4">
      <div
        role="tablist"
        aria-label="Homepage"
        className="relative grid border-b border-line"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={t.id === active}
            aria-controls={`panel-${t.id}`}
            onClick={() => setActive(t.id)}
            className={`min-h-11 text-sm font-bold transition-colors ${t.id === active ? "text-accent" : "text-muted"}`}
          >
            {t.label}
          </button>
        ))}
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-0.5 bg-accent transition-transform duration-[var(--t-base)] ease-[var(--ease)]"
          style={{
            width: `${100 / tabs.length}%`,
            transform: `translateX(${index * 100}%)`,
          }}
        />
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          hidden={t.id !== active}
        >
          {t.panel}
        </div>
      ))}
    </div>
  );
}
