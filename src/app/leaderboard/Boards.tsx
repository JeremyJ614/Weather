import { Crown, Medal, Sparkles } from "lucide-react";
import { AwardBadge } from "@/components/ui/award-badge";
import s from "./Leaderboard.module.css";

export type Board = {
  user_id: string;
  name: string;
  points: number;
  games: number;
}[];
export type Title = {
  kind: "month" | "year";
  period: string;
  name: string;
  points: number | null;
  entered: boolean;
};

const ord = (n: number) => {
  const v = n % 100;
  return (
    n +
    (["th", "st", "nd", "rd"][(v - 20) % 10] ??
      ["th", "st", "nd", "rd"][v] ??
      "th")
  );
};
const monthLabel = (ym: string) =>
  new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

/** Top three on a podium, the rest ranked below; the viewer's row glows. */
export function Podium({ board, me }: { board: Board; me: string | null }) {
  if (!board.length)
    return (
      <p className={s.empty}>
        No points yet in this period. Play today&apos;s Forecast Game or Trivia
        to get on the board.
      </p>
    );
  const top = board.slice(0, 3);
  const order = [top[1], top[0], top[2]];
  const mine = board.findIndex((r) => r.user_id === me);
  return (
    <div className="grid gap-3">
      <div className={s.podium}>
        {order.map((r, i) =>
          r ? (
            <div
              key={r.user_id}
              className={`${s.step} ${[s.silver, s.gold, s.bronze][i]} ${r.user_id === me ? s.meStep : ""}`}
              style={{ ["--d" as string]: [1, 0, 2][i] }}
            >
              {i === 1 ? <Crown aria-hidden /> : <Medal aria-hidden />}
              <b>{r.name}</b>
              <span>{r.points.toLocaleString()}</span>
              <i />
            </div>
          ) : (
            <div key={i} />
          ),
        )}
      </div>
      {board.length > 3 && (
        <ol className={s.board}>
          {board.slice(3, 50).map((r, i) => (
            <li
              key={r.user_id}
              className={r.user_id === me ? s.meRow : undefined}
              style={{ ["--d" as string]: Math.min(i, 12) }}
            >
              <span className={s.rank}>{ord(i + 4)}</span>
              <span className={s.who}>{r.name}</span>
              <span className={s.games}>{r.games} plays</span>
              <b>{r.points.toLocaleString()}</b>
            </li>
          ))}
        </ol>
      )}
      {mine >= 0 && (
        <p className={s.you}>
          You&apos;re {ord(mine + 1)} with {board[mine].points.toLocaleString()}{" "}
          points.
        </p>
      )}
    </div>
  );
}

/** Yearly champions on award badges, then every monthly winner by year. */
export function Hall({ titles }: { titles: Title[] }) {
  if (!titles.length)
    return (
      <p className={s.empty}>
        The first champion is crowned on the 1st of next month. Their name goes
        here for good.
      </p>
    );
  const years = titles.filter((t) => t.kind === "year");
  const months = titles.filter((t) => t.kind === "month");
  const byYear = new Map<string, Title[]>();
  for (const t of months) {
    const y = t.period.slice(0, 4);
    byYear.set(y, [...(byYear.get(y) ?? []), t]);
  }
  return (
    <div className="grid gap-6">
      {years.length > 0 && (
        <section className="grid gap-3">
          <p className="eyebrow">
            <Sparkles className="mr-1 inline size-3.5" aria-hidden /> WX
            Champions of the Year
          </p>
          {years.map((t, i) => (
            <article
              key={t.period}
              className={s.yearCard}
              style={{ ["--d" as string]: i }}
            >
              <AwardBadge kicker="WX Champion" title={`${t.period} Champion`} />
              <div>
                <b>{t.name}</b>
                {t.points !== null && (
                  <span>{t.points.toLocaleString()} points</span>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
      {[...byYear].map(([year, list]) => (
        <section key={year} className="grid gap-2">
          <p className="eyebrow">{year} · Monthly champions</p>
          <ol className={s.months}>
            {list.map((t, i) => (
              <li key={t.period} style={{ ["--d" as string]: i }}>
                <Crown aria-hidden />
                <span className={s.month}>{monthLabel(t.period)}</span>
                <b>{t.name}</b>
                {t.points !== null && (
                  <span className={s.pts}>{t.points.toLocaleString()}</span>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
