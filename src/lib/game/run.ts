import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  gameDate,
  parseReports,
  scoreSevere,
  scoreTornado,
  type PinSet,
  type Report,
} from "./score";

const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };

/** The SPC storm reports for one convective day (12Z to 12Z), by kind. */
export async function dayReports(ymd: string): Promise<Report[]> {
  const yymmdd = ymd.slice(2).replace(/-/g, "");
  const kinds: Report["kind"][] = ["torn", "hail", "wind"];
  const parts = await Promise.all(
    kinds.map(async (kind) => {
      try {
        const r = await fetch(
          `https://www.spc.noaa.gov/climo/reports/${yymmdd}_rpts_${kind}.csv`,
          {
            headers: UA,
            next: { revalidate: 600 },
            signal: AbortSignal.timeout(15000),
          },
        );
        return r.ok ? parseReports(await r.text(), kind) : [];
      } catch {
        return [];
      }
    }),
  );
  return parts.flat();
}

type Row = {
  id: string;
  user_id: string;
  lat: number;
  lon: number;
  tor_lat: number | null;
  tor_lon: number | null;
  points: number | null;
};

/**
 * Scores one round. The whole field is read (placement is relative); only rows
 * still unscored are written, so a re-run never pays anyone twice.
 */
export async function scoreRound(ymd: string) {
  const db = supabaseAdmin();
  const { data } = await db
    .from("game_guesses")
    .select("id,user_id,lat,lon,tor_lat,tor_lon,points")
    .eq("guess_date", ymd);
  const field = (data ?? []) as Row[];
  if (!field.some((g) => g.points === null))
    return { scored: 0, entrants: field.length, reports: 0 };
  const all = await dayReports(ymd);
  const torn = all.filter((p) => p.kind === "torn");
  const pins: PinSet[] = field.map((g) => ({
    lat: g.lat,
    lon: g.lon,
    tor:
      g.tor_lat !== null && g.tor_lon !== null
        ? { lat: g.tor_lat, lon: g.tor_lon }
        : null,
  }));
  const severe = scoreSevere(pins, all);
  const tornado = scoreTornado(pins, torn);
  const now = new Date().toISOString();
  let scored = 0;
  for (let i = 0; i < field.length; i++) {
    const g = field[i];
    if (g.points !== null) continue;
    const total = severe[i] + tornado[i];
    const { data: hit } = await db
      .from("game_guesses")
      .update({
        severe_points: severe[i],
        tornado_points: tornado[i],
        points: total,
        scored_at: now,
      })
      .eq("id", g.id)
      .is("points", null)
      .select("id");
    // Only the run that actually scored the row credits the ledger.
    if (!hit?.length) continue;
    await db.from("game_points").insert({
      user_id: g.user_id,
      source: "forecast_game",
      points: total,
      earned_on: ymd,
      detail: {
        severe: severe[i],
        tornado: tornado[i],
        quiet_call: g.tor_lat === null,
      },
    });
    scored++;
  }
  return { scored, entrants: field.length, reports: all.length };
}

/** Crowns one period's champion once: the top total across all WX Games points. */
async function crown(
  kind: "month" | "year",
  period: string,
  from: string,
  to: string,
) {
  const db = supabaseAdmin();
  const { data: done } = await db
    .from("game_titles")
    .select("id")
    .eq("kind", kind)
    .eq("period", period)
    .maybeSingle();
  if (done) return null;
  const { data } = await db
    .from("game_points")
    .select("user_id,points")
    .gte("earned_on", from)
    .lt("earned_on", to);
  const tally = new Map<string, number>();
  for (const r of data ?? [])
    tally.set(r.user_id, (tally.get(r.user_id) ?? 0) + r.points);
  const top = [...tally].sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] <= 0) return null;
  await db
    .from("game_titles")
    .insert({ kind, period, user_id: top[0], points: top[1] });
  return period;
}

/** On the 1st (Eastern), crowns last month; on January 1st, last year too. */
export async function settleMonth(at = new Date()) {
  const today = gameDate(at);
  if (!today.endsWith("-01")) return null;
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  const month = d.toISOString().slice(0, 7);
  const settled = [await crown("month", month, `${month}-01`, today)];
  if (today.endsWith("-01-01")) {
    const year = String(Number(today.slice(0, 4)) - 1);
    settled.push(await crown("year", year, `${year}-01-01`, today));
  }
  return settled.filter(Boolean);
}
