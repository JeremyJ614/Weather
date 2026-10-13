import type { Metadata } from "next";
import { CircleHelp, Gamepad2, Radar } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { HomeTabs } from "@/features/news/HomeTabs";
import { getViewer } from "@/lib/auth/viewer";
import { getSiteDefaults } from "@/lib/settings";
import { supabaseServer } from "@/lib/supabase/server";
import { gameDate } from "@/lib/game/score";
import { GameView, type Guess } from "./GameView";

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
  if (viewer.signedIn) {
    const sb = await supabaseServer();
    const [a, b] = await Promise.all([
      sb
        .from("game_guesses")
        .select(SELECT)
        .eq("guess_date", today)
        .maybeSingle(),
      sb
        .from("game_guesses")
        .select(SELECT)
        .not("points", "is", null)
        .order("guess_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    mine = a.data as Guess | null;
    last = b.data as Guess | null;
  }
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Gamepad2 aria-hidden />}
        eyebrow={["Forecast Game", "Daily Trivia"]}
        title="WX Games"
        subtitle="Call where today's severe weather and tornadoes will hit, and test your weather knowledge. Every point counts toward the Leaderboard."
      />
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
            sub: "Five questions a day",
            icon: <CircleHelp aria-hidden />,
            panel: (
              <p className="panel rounded-2xl p-4 text-sm text-muted">
                Daily Trivia is being built in phase 27.
              </p>
            ),
          },
        ]}
      />
    </main>
  );
}
