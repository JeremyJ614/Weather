"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { money, type Billing, type Promo } from "@/lib/billing/plans";
import { saveBilling } from "./actions";

type Page = { slug: string; label: string };
const field = "min-h-10 w-full rounded-xl border border-line bg-bg px-3";
const box = "grid gap-3 rounded-2xl border border-line bg-surface p-4";
const toCents = (v: string) =>
  Math.round(Number(v.replace(/[^\d.]/g, "")) * 100);
const dollars = (c: number) => (c / 100).toFixed(2);

/** Tiers, add-ons and promotions in one form; saved together. */
export function PricingEditor({
  initial,
  claims,
  pages,
}: {
  initial: Billing;
  claims: Record<string, number>;
  pages: Page[];
}) {
  const [b, setB] = useState(initial);
  const [tab, setTab] = useState<"plans" | "addons" | "promos">("plans");
  const [status, setStatus] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const edit = (next: Billing) => {
    setB(next);
    setDirty(true);
    setStatus(null);
  };
  const tier = (i: number, patch: Partial<Billing["tiers"][number]>) =>
    edit({
      ...b,
      tiers: b.tiers.map((t, k) => (k === i ? { ...t, ...patch } : t)),
    });
  const promo = (i: number, patch: Partial<Promo>) =>
    edit({
      ...b,
      promos: b.promos.map((p, k) => (k === i ? { ...p, ...patch } : p)),
    });

  return (
    <section className="grid gap-3">
      <div
        className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-surface p-1"
        role="tablist"
      >
        {(
          [
            ["plans", "Plans"],
            ["addons", "Add-ons"],
            ["promos", "Promotions"],
          ] as const
        ).map(([id, l]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="min-h-10 rounded-xl border border-transparent text-sm font-bold text-muted aria-selected:border-[var(--lit-line)] aria-selected:bg-[var(--lit)] aria-selected:text-accent"
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "plans" &&
        b.tiers.map((t, i) => (
          <div key={t.id} className={box}>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs text-muted">
                Name
                <input
                  className={field}
                  value={t.name}
                  maxLength={30}
                  onChange={(e) => tier(i, { name: e.target.value })}
                />
              </label>
              <label className="grid gap-1 text-xs text-muted">
                Tagline
                <input
                  className={field}
                  value={t.tagline}
                  maxLength={80}
                  onChange={(e) => tier(i, { tagline: e.target.value })}
                />
              </label>
            </div>
            {t.id !== "free" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-xs text-muted">
                  Monthly ($)
                  <input
                    className={`${field} mono`}
                    inputMode="decimal"
                    defaultValue={dollars(t.month)}
                    onBlur={(e) => tier(i, { month: toCents(e.target.value) })}
                  />
                </label>
                <label className="grid gap-1 text-xs text-muted">
                  Yearly ($)
                  <input
                    className={`${field} mono`}
                    inputMode="decimal"
                    defaultValue={dollars(t.year)}
                    onBlur={(e) => tier(i, { year: toCents(e.target.value) })}
                  />
                </label>
              </div>
            )}
            {t.id === "vip" ? (
              <p className="text-xs text-muted">
                VIP opens every page, including pages built later.
              </p>
            ) : (
              <details>
                <summary className="cursor-pointer text-sm font-bold">
                  Pages ·{" "}
                  {
                    t.pages.filter((p) => pages.some((x) => x.slug === p))
                      .length
                  }{" "}
                  of {pages.length}
                </summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pages.map((p) => {
                    const on = t.pages.includes(p.slug);
                    return (
                      <button
                        key={p.slug}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          tier(i, {
                            pages: on
                              ? t.pages.filter((x) => x !== p.slug)
                              : [...t.pages, p.slug],
                          })
                        }
                        className="min-h-8 rounded-full border border-line px-3 text-xs aria-pressed:border-[var(--lit-line)] aria-pressed:bg-[var(--lit)] aria-pressed:text-accent"
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
        ))}

      {tab === "addons" && (
        <div className={box}>
          <label className="grid gap-1 text-xs text-muted">
            Every add-on page, per month ($)
            <input
              className={`${field} mono`}
              inputMode="decimal"
              defaultValue={dollars(b.addons.each)}
              onBlur={(e) =>
                edit({
                  ...b,
                  addons: { ...b.addons, each: toCents(e.target.value) },
                })
              }
            />
          </label>
          <p className="text-sm font-bold">Pages with their own price</p>
          <ul className="grid gap-1.5">
            {pages.map((p) => {
              const own = b.addons.special[p.slug];
              return (
                <li key={p.slug} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{p.label}</span>
                  <input
                    aria-label={`${p.label} price`}
                    className={`${field} mono w-24 text-right`}
                    inputMode="decimal"
                    placeholder={dollars(b.addons.each)}
                    defaultValue={own !== undefined ? dollars(own) : ""}
                    onBlur={(e) => {
                      const special = { ...b.addons.special };
                      if (e.target.value.trim())
                        special[p.slug] = toCents(e.target.value);
                      else delete special[p.slug];
                      edit({ ...b, addons: { ...b.addons, special } });
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tab === "promos" &&
        b.promos.map((p, i) => (
          <div key={p.id} className={box}>
            <label className="flex items-center justify-between gap-3">
              <span>
                <b>{p.name}</b>
                {p.firstN && (
                  <small className="block text-muted">
                    {claims[p.id] ?? 0} of {p.firstN} claimed
                  </small>
                )}
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={p.on}
                onChange={(e) => promo(i, { on: e.target.checked })}
                className="size-5 accent-[var(--accent)]"
              />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              What members see
              <input
                className={field}
                value={p.blurb}
                maxLength={120}
                onChange={(e) => promo(i, { blurb: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs text-muted">
                % off month 1, 2, 3…
                <input
                  className={`${field} mono`}
                  defaultValue={p.months.join(", ")}
                  placeholder="e.g. 100, 50"
                  onBlur={(e) =>
                    promo(i, {
                      months: e.target.value
                        .split(/[,\s]+/)
                        .filter(Boolean)
                        .map(Number)
                        .filter((n) => n >= 0 && n <= 100),
                    })
                  }
                />
              </label>
              <label className="grid gap-1 text-xs text-muted">
                % off a first year
                <input
                  className={`${field} mono`}
                  type="number"
                  min={0}
                  max={100}
                  value={p.yearPct ?? 0}
                  onChange={(e) =>
                    promo(i, { yearPct: Number(e.target.value) })
                  }
                />
              </label>
              {p.firstN !== undefined && (
                <label className="grid gap-1 text-xs text-muted">
                  First how many signups
                  <input
                    className={`${field} mono`}
                    type="number"
                    min={1}
                    value={p.firstN}
                    onChange={(e) =>
                      promo(i, { firstN: Number(e.target.value) })
                    }
                  />
                </label>
              )}
              <label className="grid gap-1 text-xs text-muted">
                Starts
                <input
                  className={field}
                  type="date"
                  value={p.from ?? ""}
                  onChange={(e) => promo(i, { from: e.target.value || null })}
                />
              </label>
              <label className="grid gap-1 text-xs text-muted">
                Ends
                <input
                  className={field}
                  type="date"
                  value={p.until ?? ""}
                  onChange={(e) => promo(i, { until: e.target.value || null })}
                />
              </label>
            </div>
          </div>
        ))}

      <div className="sticky bottom-3 z-10 grid gap-2 rounded-2xl border border-line bg-bg p-3 shadow-[0_-8px_30px_rgb(0_0_0/.5)]">
        {status && (
          <p role="status" className="text-sm text-accent">
            {status}
          </p>
        )}
        <Button
          type="button"
          variant="primary"
          disabled={pending || !dirty}
          onClick={() =>
            start(async () => {
              const r = await saveBilling(JSON.stringify(b));
              setStatus(r?.error ?? r?.ok ?? null);
              if (!r?.error) setDirty(false);
            })
          }
        >
          {pending
            ? "Saving…"
            : dirty
              ? "Save pricing"
              : `Saved · Basic ${money(b.tiers[1].month)}/mo`}
        </Button>
      </div>
    </section>
  );
}
