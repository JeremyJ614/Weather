import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getBilling } from "@/lib/billing/server";
import { money } from "@/lib/billing/plans";
import { revenue, type SubRow } from "@/lib/billing/revenue";

export const metadata: Metadata = {
  title: "Revenue summary · Admin · StormSync Media",
};

/** What money is actually coming in, next to what is comped or unpaid (VIP #17). */
export default async function Revenue() {
  const { supabase } = await requireAdmin("billing");
  const [{ data }, { count }, billing] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("tier, cycle, status, comped, regular_cents"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    getBilling(),
  ]);
  const r = revenue(billing, (data ?? []) as SubRow[], count ?? 0);
  const tiles: [string, string, string][] = [
    ["Monthly recurring", money(r.mrr), `${r.paying} paying`],
    ["Yearly run rate", money(r.mrr * 12), "recurring only"],
    [
      "Comped",
      String(r.comped),
      `${money(r.forgone)}/mo list value, not income`,
    ],
    [
      "Waiting to pay",
      String(r.waiting),
      `${money(r.waitingValue)}/mo once checkout opens`,
    ],
  ];
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 pt-6 pb-24">
      <div>
        <h1 className="display text-3xl text-accent">Revenue summary</h1>
        <p className="mt-1 text-sm text-muted">
          Income counts only plans that are active and billed. Comped plans and
          plans waiting for checkout are shown beside it, never added in.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map(([k, v, sub]) => (
          <div
            key={k}
            className="grid gap-0.5 rounded-2xl border border-line bg-surface p-3"
          >
            <span className="text-xs text-muted">{k}</span>
            <b className="mono text-2xl text-accent">{v}</b>
            <span className="text-[11px] text-muted">{sub}</span>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface p-3">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 font-semibold">Plan</th>
              <th className="text-right font-semibold">Members</th>
              <th className="text-right font-semibold">Paying</th>
              <th className="text-right font-semibold">Comped</th>
              <th className="text-right font-semibold">Waiting</th>
              <th className="text-right font-semibold">MRR</th>
            </tr>
          </thead>
          <tbody>
            {r.slices.map((s) => (
              <tr key={s.tier} className="border-t border-line">
                <td className="py-2">{s.tier}</td>
                <td className="text-right">{s.members}</td>
                <td className="text-right">{s.paying}</td>
                <td className="text-right">{s.comped}</td>
                <td className="text-right">{s.waiting}</td>
                <td className="mono text-right">{money(s.mrr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Card payments aren&apos;t connected yet, so no plan is billed and income
        reads $0.00 until checkout opens (Phase 64).
      </p>
    </main>
  );
}
