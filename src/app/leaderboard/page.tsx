import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Crown, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHero } from "@/components/ui/PageHero";
import { HomeTabs } from "@/features/news/HomeTabs";
import { getViewer } from "@/lib/auth/viewer";
import { supabaseServer } from "@/lib/supabase/server";
import { gameDate } from "@/lib/game/score";
import { Hall, Podium, type Board, type Title } from "./Boards";
import s from "./Leaderboard.module.css";

export const metadata: Metadata = { title: "Leaderboard · StormSync Media" };

/** Monday of the week, the 1st of the month and January 1st, on the Eastern clock. */
function periods(today: string) {
  const d = new Date(`${today}T12:00:00Z`);
  const week = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return {
    week,
    month: `${today.slice(0, 7)}-01`,
    year: `${today.slice(0, 4)}-01-01`,
  };
}

export default async function Leaderboard() {
  const viewer = await getViewer();
  const today = gameDate();
  const head = (
    <PageHero
      icon={<Trophy aria-hidden />}
      eyebrow={["Weatherdle", "Forecast Game", "Daily Trivia"]}
      title="Leaderboard"
      subtitle="Every WX Games point, ranked by week, month and year, and the Champions Hall of every monthly and yearly winner."
    />
  );
  if (!viewer.signedIn)
    return (
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
        {head}
        <section className={s.signin}>
          <p>Sign in to see the standings and the Champions Hall.</p>
          <Link href="/login?next=/leaderboard">
            <Button variant="primary">Sign in</Button>
          </Link>
        </section>
      </main>
    );

  const sb = await supabaseServer();
  const p = periods(today);
  const board = (from: string) =>
    sb.rpc("game_board", { p_from: from, p_to: today, p_source: null });
  const [w, m, y, h, c] = await Promise.all([
    board(p.week),
    board(p.month),
    board(p.year),
    sb.rpc("game_hall"),
    sb.auth.getClaims(),
  ]);
  const me = (c.data?.claims.sub as string | undefined) ?? null;
  const monthName = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      {head}
      <HomeTabs
        variant="arcade"
        label="Leaderboard"
        tabs={[
          {
            id: "standings",
            label: "Leaderboard",
            sub: "This week, month and year",
            icon: <Trophy aria-hidden />,
            panel: (
              <HomeTabs
                variant="segment"
                label="Period"
                tabs={[
                  {
                    id: "lb-week",
                    label: "Week",
                    icon: <CalendarDays aria-hidden />,
                    panel: <Podium board={(w.data ?? []) as Board} me={me} />,
                  },
                  {
                    id: "lb-month",
                    label: monthName,
                    panel: <Podium board={(m.data ?? []) as Board} me={me} />,
                  },
                  {
                    id: "lb-year",
                    label: today.slice(0, 4),
                    panel: <Podium board={(y.data ?? []) as Board} me={me} />,
                  },
                ]}
              />
            ),
          },
          {
            id: "champions",
            label: "Champions Hall",
            sub: "Every monthly & yearly winner",
            icon: <Crown aria-hidden />,
            panel: <Hall titles={(h.data ?? []) as Title[]} />,
          },
        ]}
      />
    </main>
  );
}
