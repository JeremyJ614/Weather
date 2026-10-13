import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";

export const metadata: Metadata = {
  title: "Text requests · Admin · StormSync Media",
};

const hour = (h: number) => `${h % 12 || 12}:00 ${h < 12 ? "AM" : "PM"}`;

/** Members who asked for the Daily Brief by text (sent outside the app), plus the delivery report. */
export default async function Sms() {
  const { supabase } = await requireAdmin("sms");
  const [{ data: subs }, { data: report }] = await Promise.all([
    supabase
      .from("brief_subscriptions")
      .select("user_id, label, time_zone, send_hour")
      .eq("by_text", true)
      .order("send_hour"),
    supabase
      .from("brief_deliveries")
      .select("day, channel, sent, failed")
      .order("day", { ascending: false })
      .limit(42),
  ]);
  const ids = (subs ?? []).map((s) => s.user_id);
  const { data: people } = ids.length
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name, phone")
        .in("id", ids)
    : { data: [] };
  const who = new Map((people ?? []).map((p) => [p.id, p]));
  const days = [...new Set((report ?? []).map((r) => r.day))];

  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 pt-6 pb-24">
      <section className="grid gap-3">
        <h1 className="display text-3xl text-accent">Text requests</h1>
        <p className="text-sm text-muted">
          Members who want the Daily Brief by text. Their brief is the same one
          emailed at that hour.
        </p>
        {!subs?.length ? (
          <p className="text-muted">Nobody has asked for texts yet.</p>
        ) : (
          <ul className="grid gap-2">
            {subs.map((s) => {
              const p = who.get(s.user_id);
              return (
                <li
                  key={s.user_id}
                  className="rounded-xl border border-line bg-surface px-3 py-2 text-sm"
                >
                  <b>{p ? `${p.first_name} ${p.last_name}` : "Member"}</b>
                  {p?.phone && (
                    <a
                      href={`sms:${p.phone}`}
                      className="ml-2 text-accent underline"
                    >
                      {p.phone}
                    </a>
                  )}
                  <span className="block text-xs text-muted">
                    {hour(s.send_hour)} ·{" "}
                    {s.time_zone.replace("America/", "").replace("_", " ")} ·{" "}
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="grid gap-3">
        <h2 className="display text-2xl text-accent">Brief delivery report</h2>
        {!days.length ? (
          <p className="text-muted">No briefs sent yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1 font-normal">Day</th>
                <th className="font-normal">Email</th>
                <th className="font-normal">Push</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const cell = (c: string) => {
                  const r = report!.find((x) => x.day === d && x.channel === c);
                  return r
                    ? `${r.sent} sent${r.failed ? `, ${r.failed} failed` : ""}`
                    : "–";
                };
                return (
                  <tr key={d} className="border-t border-line">
                    <td className="py-1.5">{d}</td>
                    <td>{cell("email")}</td>
                    <td>{cell("push")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
