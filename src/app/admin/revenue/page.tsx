import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getBilling } from "@/lib/billing/server";
import { money } from "@/lib/billing/plans";
import { revenue, type SubRow } from "@/lib/billing/revenue";
import {
  Bars,
  Banner,
  Card,
  Donut,
  Keys,
  Note,
  Page,
  Split,
  Stack,
  Tile,
  Tiles,
  TONE,
} from "@/components/admin/Dash";

export const metadata: Metadata = {
  title: "Revenue summary · Admin · StormSync Media",
};

const PLAN_COLORS = [
  "#64748b",
  TONE.info,
  TONE.good,
  TONE.warn,
  TONE.violet,
  TONE.pink,
];
const KIND = [
  { key: "paying", label: "Paying", color: TONE.good },
  { key: "comped", label: "Comped", color: TONE.violet },
  { key: "waiting", label: "Waiting to pay", color: TONE.warn },
  { key: "free", label: "No paid plan", color: "#475569" },
] as const;

/**
 * What money is actually coming in, next to what is comped or unpaid (VIP #17), laid out to
 * read at a glance (owner's follow-up #5): income first, then who is on what and why.
 */
export default async function Revenue() {
  const { supabase } = await requireAdmin("billing");
  const [{ data }, { count }, billing] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("tier, cycle, status, comped, regular_cents"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    getBilling(),
  ]);
  const rows = (data ?? []) as SubRow[];
  const members = count ?? 0;
  const r = revenue(billing, rows, members);
  const arpu = r.paying ? Math.round(r.mrr / r.paying) : 0;
  const conversion = members ? (r.paying / members) * 100 : 0;
  const yearly = rows.filter(
    (x) => !x.comped && x.status === "active" && x.cycle === "year",
  ).length;
  const monthly = r.paying - yearly;
  const free = Math.max(0, members - r.paying - r.comped - r.waiting);
  return (
    <Page
      title="Revenue summary"
      lead="Income counts only plans that are active and billed. Comped plans and plans waiting for checkout are shown beside it, never added in."
    >
      <Banner
        color={r.mrr ? TONE.good : r.waiting ? TONE.warn : TONE.info}
        title={
          r.mrr
            ? `${money(r.mrr)} a month from ${r.paying} paying ${r.paying === 1 ? "member" : "members"}`
            : r.waiting
              ? `No income yet: ${r.waiting} waiting to pay (${money(r.waitingValue)}/mo)`
              : "No paid plans yet"
        }
        detail={`${conversion.toFixed(1)}% of ${members.toLocaleString("en-US")} accounts pay · ${money(r.mrr * 12)} a year at this rate`}
      />
      <Tiles>
        <Tile
          hero
          label="Monthly recurring"
          value={money(r.mrr)}
          sub={`${r.paying} paying`}
          color={TONE.good}
        />
        <Tile
          label="Yearly run rate"
          value={money(r.mrr * 12)}
          sub="recurring only"
          color={TONE.info}
        />
        <Tile
          label="Per paying member"
          value={money(arpu)}
          sub="average a month"
          color={TONE.violet}
        />
        <Tile
          label="Waiting to pay"
          value={r.waiting}
          sub={`${money(r.waitingValue)}/mo once they check out`}
          color={TONE.warn}
        />
      </Tiles>
      <Card
        title="Who is on what"
        meta={`${members.toLocaleString("en-US")} accounts`}
      >
        <Split>
          <Donut
            center={String(r.paying)}
            caption="paying"
            parts={r.slices.map((s, i) => ({
              label: s.tier,
              value: s.members,
              color: PLAN_COLORS[i % PLAN_COLORS.length],
            }))}
          />
          <Bars
            rows={r.slices.map((s, i) => ({
              label: s.tier,
              value: s.members,
              text: `${s.members} · ${money(s.mrr)}/mo`,
              color: PLAN_COLORS[i % PLAN_COLORS.length],
            }))}
          />
        </Split>
      </Card>
      <Card title="Paying, comped and waiting" meta="every account">
        <Stack
          parts={[
            { label: "Paying", value: r.paying, color: TONE.good },
            { label: "Comped", value: r.comped, color: TONE.violet },
            { label: "Waiting to pay", value: r.waiting, color: TONE.warn },
            { label: "No paid plan", value: free, color: "#475569" },
          ]}
        />
        <Keys items={KIND.map((k) => ({ label: k.label, color: k.color }))} />
        <Bars
          rows={r.slices
            .filter((s) => s.paying + s.comped + s.waiting)
            .map((s) => ({
              label: s.tier,
              value: s.paying + s.comped + s.waiting,
              text: `${s.paying} paying · ${s.comped} comped · ${s.waiting} waiting`,
            }))}
        />
      </Card>
      <Tiles>
        <Tile label="Monthly billing" value={monthly} sub="paying monthly" />
        <Tile label="Yearly billing" value={yearly} sub="paying yearly" />
        <Tile
          label="Comped"
          value={r.comped}
          sub={`${money(r.forgone)}/mo list value, not income`}
          color={TONE.violet}
        />
        <Tile
          label="Conversion"
          value={`${conversion.toFixed(1)}%`}
          sub="accounts that pay"
          color={TONE.pink}
        />
      </Tiles>
      <Note>
        Income is read from plans marked active by Stripe. A plan paid yearly
        counts as a twelfth each month. Free accounts and comped plans are never
        counted as income.
      </Note>
    </Page>
  );
}
