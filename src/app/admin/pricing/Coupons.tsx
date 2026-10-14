"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { money } from "@/lib/billing/plans";
import { saveCoupon, setCoupon } from "./actions";

type Coupon = {
  code: string;
  kind: string;
  amount: number;
  tiers: string[];
  starts: string | null;
  ends: string | null;
  max_uses: number | null;
  uses: number;
  active: boolean;
  note: string | null;
};
const field = "min-h-10 w-full rounded-xl border border-line bg-bg px-3";
const TIERS = [
  ["free", "Free"],
  ["basic", "Basic"],
  ["chasers", "Storm Chasers"],
  ["advanced", "Advanced"],
  ["vip", "VIP"],
];

/** Discount codes: create or update by code, switch on and off. */
export function Coupons({ list }: { list: Coupon[] }) {
  const [state, action, pending] = useActionState(saveCoupon, null);
  return (
    <section className="grid gap-3">
      <h2 className="display text-xl">Promo codes</h2>
      <form
        action={action}
        className="grid gap-3 rounded-2xl border border-line bg-surface p-4"
      >
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs text-muted">
            Code
            <input
              name="code"
              required
              maxLength={24}
              className={`${field} mono uppercase`}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted">
            Discount
            <span className="flex gap-1">
              <input
                name="amount"
                required
                inputMode="decimal"
                className={`${field} mono`}
              />
              <select name="kind" className={`${field} w-20`}>
                <option value="percent">%</option>
                <option value="fixed">$</option>
              </select>
            </span>
          </label>
          <label className="grid gap-1 text-xs text-muted">
            Starts
            <input name="starts" type="date" className={field} />
          </label>
          <label className="grid gap-1 text-xs text-muted">
            Ends
            <input name="ends" type="date" className={field} />
          </label>
          <label className="grid gap-1 text-xs text-muted">
            Max uses
            <input
              name="max"
              type="number"
              min={1}
              className={`${field} mono`}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted">
            Note
            <input name="note" maxLength={120} className={field} />
          </label>
        </div>
        <fieldset className="flex flex-wrap gap-2 text-sm">
          <legend className="mb-1 text-xs text-muted">
            Plans (none = any)
          </legend>
          {TIERS.map(([v, l]) => (
            <label key={v} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name="tiers"
                value={v}
                className="accent-[var(--accent)]"
              />{" "}
              {l}
            </label>
          ))}
        </fieldset>
        {state && (
          <p role="status" className="text-sm text-accent">
            {state.error ?? state.ok}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save code"}
        </Button>
      </form>
      {list.length === 0 ? (
        <p className="text-sm text-muted">No codes yet.</p>
      ) : (
        <ul className="grid overflow-hidden rounded-2xl border border-line bg-surface">
          {list.map((c) => (
            <li
              key={c.code}
              className="flex items-center gap-3 border-t border-line p-3 first:border-t-0"
            >
              <span className="grid flex-1 gap-0.5">
                <b className="mono">{c.code}</b>
                <small className="text-muted">
                  {c.kind === "percent"
                    ? `${c.amount}% off`
                    : `${money(c.amount)} off`}{" "}
                  · used {c.uses}
                  {c.max_uses ? ` of ${c.max_uses}` : ""}
                  {c.tiers.length ? ` · ${c.tiers.join(", ")}` : ""}
                  {c.ends ? ` · until ${c.ends}` : ""}
                </small>
              </span>
              <form action={setCoupon}>
                <input type="hidden" name="code" value={c.code} />
                <input type="hidden" name="on" value={c.active ? "0" : "1"} />
                <button
                  type="submit"
                  className="min-h-9 rounded-full border border-line px-3 text-xs font-bold aria-pressed:border-[var(--lit-line)] aria-pressed:bg-[var(--lit)] aria-pressed:text-accent"
                  aria-pressed={c.active}
                >
                  {c.active ? "On" : "Off"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
