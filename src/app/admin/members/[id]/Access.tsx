"use client";

import { useActionState, useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { NavIcon } from "@/components/NavIcon";
import { BadgeIcon } from "@/components/BadgeIcon";
import type { Badge } from "@/lib/badges";
import type { Colors } from "@/lib/colors/pick";
import {
  adjustReferrals,
  setBadge,
  setMemberPage,
  setPlan,
  type ToolState,
} from "../actions";

type Page = { slug: string; label: string; icon: string; inPlan: boolean };
type State = "plan" | "on" | "off";
const field = "min-h-11 w-full rounded-xl border border-line bg-bg px-3";
const NEXT: Record<State, State> = { plan: "on", on: "off", off: "plan" };

/** VIP's member tools: plan (comped), pages on/off, referral count, badges. */
export function Access({
  id,
  first,
  tier,
  cycle,
  status,
  tiers,
  pages,
  overrides,
  referrals,
  bonus,
  badges,
  owned,
  colors,
}: {
  id: string;
  first: string;
  tier: string;
  cycle: string;
  status: string;
  tiers: { id: string; name: string }[];
  pages: Page[];
  overrides: Record<string, boolean>;
  referrals: number;
  bonus: number;
  badges: Badge[];
  owned: string[];
  colors: Colors;
}) {
  const [plan, planAction, planPending] = useActionState(setPlan, null);
  const [over, setOver] = useState(overrides);
  const [have, setHave] = useState(new Set(owned));
  const [count, setCount] = useState(bonus);
  const [msg, setMsg] = useState<ToolState>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ToolState>, undo: () => void) =>
    start(async () => {
      const r = await fn();
      if (r?.error) undo();
      setMsg(r?.error ? r : null);
    });

  const state = (slug: string): State =>
    slug in over ? (over[slug] ? "on" : "off") : "plan";
  const open = pages.filter((p) =>
    state(p.slug) === "plan" ? p.inPlan : state(p.slug) === "on",
  ).length;
  const cycle1 = (slug: string) => {
    const was = { ...over };
    const next = NEXT[state(slug)];
    const o = { ...over };
    if (next === "plan") delete o[slug];
    else o[slug] = next === "on";
    setOver(o);
    run(
      () => setMemberPage(id, slug, next),
      () => setOver(was),
    );
  };

  return (
    <section className="grid gap-3">
      <form
        action={planAction}
        className="grid gap-2 rounded-2xl border border-line bg-surface p-4"
      >
        <input type="hidden" name="userId" value={id} />
        <b>Plan</b>
        <p className="text-sm text-muted">
          Now: {tiers.find((t) => t.id === tier)?.name ?? "Free"} ·{" "}
          {status.replace("_", " ")}
        </p>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <select
            name="tier"
            defaultValue={tier}
            className={field}
            aria-label="Plan"
          >
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            name="cycle"
            defaultValue={cycle}
            className={field}
            aria-label="Billing"
          >
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </div>
        <Button type="submit" disabled={planPending}>
          {planPending ? "Saving…" : "Set plan (comped)"}
        </Button>
        {plan && (
          <p role="status" className="text-sm text-accent">
            {plan.error ?? plan.ok}
          </p>
        )}
      </form>

      <div className="grid gap-2 rounded-2xl border border-line bg-surface p-4">
        <b>
          Pages · {open} of {pages.length} open
        </b>
        <p className="text-xs text-muted">
          Tap a page: as the plan says → given to {first} → closed to {first}.
          Closed pages are blocked now; given pages open when page locks go live
          with checkout.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {pages.map((p) => {
            const st = state(p.slug);
            const on = st === "plan" ? p.inPlan : st === "on";
            return (
              <button
                key={p.slug}
                type="button"
                disabled={pending}
                onClick={() => cycle1(p.slug)}
                className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${
                  st === "off"
                    ? "border-line text-muted line-through"
                    : st === "on"
                      ? "border-accent text-accent"
                      : on
                        ? "border-[var(--lit-line)]"
                        : "border-line text-muted"
                }`}
              >
                <NavIcon name={p.icon} className="size-3.5" />
                {p.label}
                {st !== "plan" && (
                  <small className="opacity-70">
                    {st === "on" ? "given" : "closed"}
                  </small>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
        <span>
          <b>Referrals · {referrals + count}</b>
          <span className="block text-xs text-muted">
            {referrals} signed up with their code
            {count ? `, ${count > 0 ? "+" : ""}${count} by hand` : ""}
          </span>
        </span>
        <span className="flex gap-2">
          {([-1, 1] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-label={d > 0 ? "Add one" : "Remove one"}
              disabled={pending || referrals + count + d < 0}
              onClick={() => {
                setCount(count + d);
                run(
                  () => adjustReferrals(id, d),
                  () => setCount(count),
                );
              }}
              className="grid size-10 place-items-center rounded-xl border border-line disabled:opacity-40"
            >
              {d > 0 ? (
                <Plus className="size-4" />
              ) : (
                <Minus className="size-4" />
              )}
            </button>
          ))}
        </span>
      </div>

      <div className="grid gap-2 rounded-2xl border border-line bg-surface p-4">
        <b>Badges · {have.size}</b>
        {!badges.length ? (
          <p className="text-sm text-muted">
            No badges yet. Make some in Admin → Badges.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
            {badges.map((b) => {
              const on = have.has(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={on}
                  disabled={pending}
                  onClick={() => {
                    const was = new Set(have);
                    const n = new Set(have);
                    if (on) n.delete(b.id);
                    else n.add(b.id);
                    setHave(n);
                    run(
                      () => setBadge(id, b.id, !on),
                      () => setHave(was),
                    );
                  }}
                  className={`grid justify-items-center gap-1 rounded-xl p-2 text-center text-[11px] ${on ? "" : "opacity-40 grayscale"}`}
                >
                  <BadgeIcon badge={b} colors={colors} size={36} />
                  {b.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {msg?.error && (
        <p role="alert" className="text-sm text-accent">
          {msg.error}
        </p>
      )}
    </section>
  );
}
