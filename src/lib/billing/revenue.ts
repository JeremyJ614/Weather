import type { Billing } from "./plans";

export type SubRow = {
  tier: string;
  cycle: string;
  status: string;
  comped: boolean;
  regular_cents: number;
};
export type Slice = {
  tier: string;
  members: number;
  paying: number;
  comped: number;
  waiting: number;
  mrr: number;
  forgone: number;
};

/**
 * Revenue means a plan that is active and billed (VIP #17). Comped plans are shown as
 * list value given away and unpaid plans as waiting; neither is ever counted as income.
 */
export function revenue(b: Billing, rows: SubRow[], members: number) {
  const perMonth = (r: SubRow) =>
    r.cycle === "year" ? Math.round(r.regular_cents / 12) : r.regular_cents;
  const list = (tier: string) => b.tiers.find((t) => t.id === tier)?.month ?? 0;
  const slices: Slice[] = b.tiers.map((t) => ({
    tier: t.name,
    members: 0,
    paying: 0,
    comped: 0,
    waiting: 0,
    mrr: 0,
    forgone: 0,
  }));
  const at = (tier: string) =>
    slices[
      Math.max(
        0,
        b.tiers.findIndex((t) => t.id === tier),
      )
    ];
  let onPlan = 0;
  for (const r of rows) {
    const s = at(r.tier);
    s.members++;
    onPlan++;
    if (r.comped) {
      s.comped++;
      s.forgone += list(r.tier);
    } else if (r.status === "active" && r.regular_cents > 0) {
      s.paying++;
      s.mrr += perMonth(r);
    } else if (r.status === "awaiting_payment") s.waiting++;
  }
  // Members who never picked a plan are on Free.
  slices[0].members += Math.max(0, members - onPlan);
  const sum = (k: keyof Omit<Slice, "tier">) =>
    slices.reduce((a, s) => a + s[k], 0);
  return {
    slices,
    mrr: sum("mrr"),
    paying: sum("paying"),
    comped: sum("comped"),
    waiting: sum("waiting"),
    forgone: sum("forgone"),
    waitingValue: rows
      .filter((r) => !r.comped && r.status === "awaiting_payment")
      .reduce((a, r) => a + perMonth(r), 0),
  };
}
