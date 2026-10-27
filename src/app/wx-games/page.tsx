import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { after } from "next/server";
import { CircleHelp, Gamepad2, Grid3x3, Radar } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { HomeTabs } from "@/features/news/HomeTabs";
import { getViewer } from "@/lib/auth/viewer";
import { getSiteDefaults } from "@/lib/settings";
import { supabaseServer } from "@/lib/supabase/server";
import { gameDate } from "@/lib/game/score";
import { healDay } from "@/lib/trivia/generate";
import { getColors } from "@/lib/colors/server";
import { healWord } from "@/lib/weatherdle/make";
import { GameView, type Guess } from "./GameView";
import { TriviaView, type TriviaQ } from "./TriviaView";
import { WeatherdleView, type WdState, type WdStats } from "./WeatherdleView";

export const metadata: Metadata = pageMeta(
  "/wx-games",
  "WX Games",
  "Guess the day's weather word, call where today's severe weather and tornadoes will hit, and test your weather knowledge. Every point counts toward the Leaderboard.",
);

const SELECT =
  "guess_date,lat,lon,city_label,tor_lat,tor_lon,tor_city_label,severe_points,tornado_points,points";

/** Games played, words solved, and solved days in a row up to today (or yesterday). */
function weatherdleStats(
  rows: { day: string; solved: boolean; guesses: string[] }[],
  today: string,
): WdStats {
  const played = rows.filter((r) => r.solved || r.guesses.length >= 6);
  const solved = new Set(rows.filter((r) => r.solved).map((r) => r.day));
  let streak = 0;
  const d = new Date(`${today}T12:00:00Z`);
  // Today not solved yet doesn't break the streak until the day is over.
  if (!solved.has(today)) d.setUTCDate(d.getUTCDate() - 1);
  while (solved.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return { played: played.length, solved: solved.size, streak };
}

export default async function WxGames() {
  const [viewer, { disabled }, colors] = await Promise.all([
    getViewer(),
    getSiteDefaults(),
    getColors(),
  ]);
  const today = gameDate();
  let mine: Guess | null = null;
  let last: Guess | null = null;
  let trivia: TriviaQ[] = [];
  let word: WdState | null = null;
  let wordStats: WdStats | null = null;
  if (viewer.lens) {
    // The owner viewing as a member: the member's rounds, through owner-only functions.
    const sb = await supabaseServer();
    const [g, t] = await Promise.all([
      sb.rpc("lens_guesses", { p_user: viewer.id! }),
      sb.rpc("lens_trivia_today", { p_user: viewer.id! }),
    ]);
    const rows = (g.data ?? []) as (Guess & { guess_date: string })[];
    mine = rows.find((r) => r.guess_date === today) ?? null;
    last = rows.find((r) => r.points !== null) ?? null;
    trivia = (t.data ?? []) as TriviaQ[];
  } else if (viewer.signedIn) {
    const sb = await supabaseServer();
    const [a, b, t, wd, plays] = await Promise.all([
      sb
        .from("game_guesses")
        .select(SELECT)
        .eq("user_id", viewer.id!)
        .eq("guess_date", today)
        .maybeSingle(),
      sb
        .from("game_guesses")
        .select(SELECT)
        .eq("user_id", viewer.id!)
        .not("points", "is", null)
        .order("guess_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb.rpc("trivia_today"),
      sb.rpc("weatherdle_state"),
      sb
        .from("weatherdle_plays")
        .select("day, solved, guesses")
        .eq("user_id", viewer.id!)
        .order("day", { ascending: false })
        .limit(400),
    ]);
    word = (wd.data as WdState | null) ?? null;
    if (!wd.error && word && word.length == null) after(() => healWord(today));
    wordStats = weatherdleStats(
      (plays.data ?? []) as {
        day: string;
        solved: boolean;
        guesses: string[];
      }[],
      today,
    );
    mine = a.data as Guess | null;
    last = b.data as Guess | null;
    trivia = (t.data ?? []) as TriviaQ[];
    if (!t.error && !trivia.length) after(() => healDay(today));
  }
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Gamepad2 aria-hidden />}
        eyebrow={["Weatherdle", "Forecast Game", "Daily Trivia"]}
        title="WX Games"
        subtitle="Guess the day's weather word, call where today's severe weather and tornadoes will hit, and test your weather knowledge. Every point counts toward the Leaderboard."
      />
      {viewer.lens && (
        <p className="mb-4 rounded-2xl border border-[var(--lit-line)] bg-[var(--lit)] p-3 text-sm">
          You&apos;re playing as <b className="text-accent">{viewer.name}</b>.
          Pins and answers go in as theirs and count toward their points; each
          one is recorded in the audit log under your name.
        </p>
      )}
      <HomeTabs
        variant="arcade"
        label="WX Games"
        tabs={[
          {
            id: "weatherdle",
            label: "Weatherdle",
            sub: "Guess the weather word",
            icon: <Grid3x3 aria-hidden />,
            panel: disabled.includes("weatherdle") ? (
              <ModuleOff label="Weatherdle" />
            ) : (
              <WeatherdleView
                signedIn={viewer.signedIn}
                lens={Boolean(viewer.lens)}
                initial={word}
                stats={wordStats}
                colors={colors}
              />
            ),
          },
          {
            id: "forecast-game",
            label: "Forecast Game",
            sub: "Pin today's storms",
            icon: <Radar aria-hidden />,
            panel: disabled.includes("game") ? (
              <ModuleOff label="The Forecast Game" />
            ) : (
              <GameView
                signedIn={viewer.signedIn}
                today={today}
                mine={mine}
                last={last}
              />
            ),
          },
          {
            id: "daily-trivia",
            label: "Daily Trivia",
            sub: "Fresh questions daily",
            icon: <CircleHelp aria-hidden />,
            panel: disabled.includes("trivia") ? (
              <ModuleOff label="Daily Trivia" />
            ) : (
              <TriviaView signedIn={viewer.signedIn} questions={trivia} />
            ),
          },
        ]}
      />
    </main>
  );
}
