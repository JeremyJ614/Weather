import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { gameDate } from "@/lib/game/score";
import { mondayOf, removePoll } from "./actions";
import { PollForm, type AdminPoll } from "./PollForm";
import s from "./Polls.module.css";

export const metadata: Metadata = {
  title: "Weekly Polls · Admin · StormSync Media",
};

type Row = AdminPoll & { ends_on: string };

/** Schedule weekly polls ahead, edit ones nobody has voted on, read the tallies. */
export default async function PollsAdmin() {
  const { supabase } = await requireAdmin("polls");
  const today = gameDate();
  const thisWeek = await mondayOf(today);
  const { data } = await supabase
    .from("polls")
    .select("id, question, options, note, starts_on, ends_on")
    .order("starts_on", { ascending: false })
    .limit(60);
  const polls = (data ?? []) as Row[];
  const ids = polls.map((p) => p.id);
  const { data: votes } = ids.length
    ? await supabase
        .from("poll_votes")
        .select("poll_id, choice")
        .in("poll_id", ids)
    : { data: [] };
  const tally = new Map<string, number[]>();
  for (const v of votes ?? []) {
    const t = tally.get(v.poll_id) ?? [];
    t[v.choice] = (t[v.choice] ?? 0) + 1;
    tally.set(v.poll_id, t);
  }
  const groups: [string, Row[]][] = [
    ["Upcoming", polls.filter((p) => p.starts_on > today).reverse()],
    [
      "Open now",
      polls.filter((p) => p.starts_on <= today && p.ends_on >= today),
    ],
    ["Past", polls.filter((p) => p.ends_on < today)],
  ];

  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 pt-6 pb-24">
      <section className="grid gap-2">
        <h1 className="display text-3xl text-accent">Weekly Polls</h1>
        <p className="text-sm text-muted">
          Schedule a poll for any week ahead. It appears to members on that
          Monday and closes Sunday night (Eastern). Members see the results
          after they vote.
        </p>
      </section>
      <section className="grid gap-3">
        <h2 className="display text-xl">Schedule a poll</h2>
        <PollForm week={thisWeek} />
      </section>
      {groups.map(([title, list]) =>
        list.length ? (
          <section key={title} className="grid gap-3">
            <h2 className="display text-xl">{title}</h2>
            {list.map((p) => {
              const t = tally.get(p.id) ?? [];
              const total = t.reduce((a, n) => a + (n ?? 0), 0);
              return (
                <details key={p.id} className={s.item}>
                  <summary>
                    <span className={s.week}>{p.starts_on}</span>
                    <span className={s.sumQ}>{p.question}</span>
                    <span className={s.count}>{total} votes</span>
                  </summary>
                  <ul className={s.tally}>
                    {p.options.map((o, i) => (
                      <li key={i}>
                        <span>{o}</span>
                        <b>{t[i] ?? 0}</b>
                      </li>
                    ))}
                  </ul>
                  {total === 0 && p.ends_on >= today && (
                    <PollForm poll={p} week={thisWeek} />
                  )}
                  <form action={removePoll} className={s.remove}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit">Delete this poll</button>
                  </form>
                </details>
              );
            })}
          </section>
        ) : null,
      )}
    </main>
  );
}
