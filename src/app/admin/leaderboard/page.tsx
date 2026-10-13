import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { gameDate } from "@/lib/game/score";
import { removeTitle } from "./actions";
import { AdjustForm, TitleForm } from "./Forms";
import s from "./Admin.module.css";

export const metadata: Metadata = {
  title: "Leaderboard · Admin · StormSync Media",
};

const period = (kind: string, p: string) =>
  kind === "year"
    ? `${p} · Yearly`
    : new Date(`${p}-15T12:00:00Z`).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });

/** Point adjustments and the Champions Hall, for admins with the Leaderboard permission. */
export default async function LeaderboardAdmin() {
  const { supabase } = await requireAdmin("leaderboard");
  const today = gameDate();
  const [{ data: titles }, { data: recent }] = await Promise.all([
    supabase.rpc("game_hall"),
    supabase
      .from("game_points")
      .select("id, points, earned_on, detail, created_at")
      .eq("source", "admin")
      .order("created_at", { ascending: false })
      .limit(25),
  ]);
  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 pt-6 pb-24">
      <section className="grid gap-2">
        <h1 className="display text-3xl text-accent">Leaderboard</h1>
        <p className="text-sm text-muted">
          Adjust a member&apos;s WX Games points and keep the Champions Hall
          complete. Every change is written to the audit log.
        </p>
      </section>
      <AdjustForm today={today} />
      <TitleForm today={today} />

      <section className="grid gap-3">
        <h2 className="display text-xl">Champions Hall</h2>
        {!titles?.length ? (
          <p className="text-sm text-muted">No champions yet.</p>
        ) : (
          <ul className={s.list}>
            {(
              titles as {
                kind: string;
                period: string;
                name: string;
                points: number | null;
                entered: boolean;
              }[]
            ).map((t) => (
              <li key={`${t.kind}-${t.period}`}>
                <span>
                  <b>{t.name}</b>
                  <small>
                    {period(t.kind, t.period)}
                    {t.points !== null && ` · ${t.points.toLocaleString()} pts`}
                    {t.entered
                      ? " · entered by an admin"
                      : " · crowned automatically"}
                  </small>
                </span>
                <form action={removeTitle}>
                  <input type="hidden" name="kind" value={t.kind} />
                  <input type="hidden" name="period" value={t.period} />
                  <button type="submit">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="display text-xl">Recent adjustments</h2>
        {!recent?.length ? (
          <p className="text-sm text-muted">No adjustments yet.</p>
        ) : (
          <ul className={s.list}>
            {recent.map((r) => {
              const d = r.detail as {
                note?: string;
                name?: string;
                by?: string;
              };
              return (
                <li key={r.id}>
                  <span>
                    <b>{d.name ?? "Member"}</b>
                    <small>
                      {d.note} · counts on {r.earned_on}
                      {d.by && ` · by ${d.by}`}
                    </small>
                  </span>
                  <span className={r.points > 0 ? s.plus : s.minus}>
                    {r.points > 0 ? "+" : ""}
                    {r.points.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
