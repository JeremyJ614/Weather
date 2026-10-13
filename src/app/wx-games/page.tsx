import type { Metadata } from "next";
import { Gamepad2 } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getViewer } from "@/lib/auth/viewer";
import { getSiteDefaults } from "@/lib/settings";
import { supabaseServer } from "@/lib/supabase/server";
import { gameDate } from "@/lib/game/score";
import { GameView, type Board, type Guess } from "./GameView";

export const metadata: Metadata = { title: "WX Games · StormSync Media" };

const SELECT =
  "guess_date,lat,lon,city_label,tor_lat,tor_lon,tor_city_label,severe_points,tornado_points,points";

export default async function ForecastGame() {
  const [viewer, { disabled }] = await Promise.all([
    getViewer(),
    getSiteDefaults(),
  ]);
  const today = gameDate();
  let mine: Guess | null = null;
  let last: Guess | null = null;
  let month: Board = [];
  let week: Board = [];
  let champions: { month: string; name: string; points: number }[] = [];
  if (viewer.signedIn) {
    const sb = await supabaseServer();
    const d = new Date(`${today}T12:00:00Z`);
    const weekStart = new Date(
      d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
    const [a, b, m, w, c] = await Promise.all([
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
      sb.rpc("game_board", {
        p_from: `${today.slice(0, 7)}-01`,
        p_to: today,
        p_source: "forecast_game",
      }),
      sb.rpc("game_board", {
        p_from: weekStart,
        p_to: today,
        p_source: "forecast_game",
      }),
      sb.rpc("game_champions"),
    ]);
    mine = a.data as Guess | null;
    last = b.data as Guess | null;
    month = (m.data ?? []) as Board;
    week = (w.data ?? []) as Board;
    champions = c.data ?? [];
  }
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Gamepad2 aria-hidden />}
        eyebrow={["Forecast Game", "SPC outlooks & storm reports"]}
        title="WX Games"
        subtitle="Call where today's severe weather and tornadoes will hit. Pins lock at noon Eastern and are scored against the real storm reports."
      />
      {disabled.includes("game") ? (
        <ModuleOff label="The Forecast Game" />
      ) : (
        <GameView
          signedIn={viewer.signedIn}
          today={today}
          mine={mine}
          last={last}
          month={month}
          week={week}
          champions={champions}
        />
      )}
    </main>
  );
}
