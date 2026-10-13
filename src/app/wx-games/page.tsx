import type { Metadata } from "next";
import { after } from "next/server";
import { CircleHelp, Gamepad2, Radar } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { HomeTabs } from "@/features/news/HomeTabs";
import { getViewer } from "@/lib/auth/viewer";
import { getSiteDefaults } from "@/lib/settings";
import { supabaseServer } from "@/lib/supabase/server";
import { gameDate } from "@/lib/game/score";
import { healDay } from "@/lib/trivia/generate";
import { GameView, type Guess } from "./GameView";
import { TriviaView, type TriviaQ } from "./TriviaView";

export const metadata: Metadata = { title: "WX Games · StormSync Media" };

const SELECT =
  "guess_date,lat,lon,city_label,tor_lat,tor_lon,tor_city_label,severe_points,tornado_points,points";

export default async function WxGames() {
  const [viewer, { disabled }] = await Promise.all([
    getViewer(),
    getSiteDefaults(),
  ]);
  const today = gameDate();
  let mine: Guess | null = null;
  let last: Guess | null = null;
  let trivia: TriviaQ[] = [];
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
    const [a, b, t] = await Promise.all([
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
    ]);
    mine = a.data as Guess | null;
    last = b.data as Guess | null;
    trivia = (t.data ?? []) as TriviaQ[];
    if (!t.error && !trivia.length) after(() => healDay(today));
  }
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Gamepad2 aria-hidden />}
        eyebrow={["Forecast Game", "Daily Trivia"]}
        title="WX Games"
        subtitle="Call where today's severe weather and tornadoes will hit, and test your weather knowledge. Every point counts toward the Leaderboard."
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
