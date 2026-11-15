import { EXTRAS_ITEMS } from "@/lib/extras/items";
import { reportCards } from "@/lib/engines/verify";

/** Engines the engine-verify job checks against what happened. */
export const CHECKED_ENGINES = [
  "tor",
  "surge",
  "first",
  "bound",
  "blizz",
  "stp",
  "scp",
  "dcp",
  "nst",
  "tctor",
] as const;

const pct = (s: { checked: number; hits: number } | null) =>
  s && s.checked ? `${Math.round((100 * s.hits) / s.checked)}%` : "–";

/**
 * Post-launch A1 "skill-scores": every checked engine's hit rate over 30 and 120 days and its
 * latest hit, so the owner can see which engines earn their place and which need work.
 */
export async function ReportCards() {
  const rows = await reportCards(CHECKED_ENGINES);
  const name = (id: string) =>
    EXTRAS_ITEMS.find((x) => x.id === id)?.name ?? id;
  return (
    <section className="grid gap-2">
      <h2 className="display text-xl text-accent">Engine report cards</h2>
      <p className="text-sm text-muted">
        Each flag an engine raises is checked against storm reports, radar or
        airports once its window closes (hourly job). Rates need 10 checks to
        mean much; the engines that list places of their own (sunset, rainbow,
        deer, fishing) learn from members&apos; reports instead.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="p-2">Engine</th>
              <th className="p-2">30 days</th>
              <th className="p-2">120 days</th>
              <th className="p-2">Latest hit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.engine} className="border-t border-line align-top">
                <td className="p-2 font-semibold">{name(r.engine)}</td>
                <td className="p-2">
                  <b className="text-accent">{pct(r.month)}</b>
                  <span className="block text-xs text-muted">
                    {r.month
                      ? `${r.month.hits} of ${r.month.checked}`
                      : "no data"}
                  </span>
                </td>
                <td className="p-2">
                  <b>{pct(r.season)}</b>
                  <span className="block text-xs text-muted">
                    {r.season
                      ? `${r.season.hits} of ${r.season.checked}`
                      : "no data"}
                  </span>
                </td>
                <td className="p-2 text-xs text-muted">
                  {r.season?.last
                    ? `${new Date(r.season.last.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${r.season.last.label}`
                    : "none yet"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
