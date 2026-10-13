"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { gameDate, roundOpen } from "@/lib/game/score";

export type LockState = { error?: string; ok?: boolean } | null;

const num = (fd: FormData, k: string) => {
  const v = Number(fd.get(k));
  return Number.isFinite(v) ? v : null;
};
const inUS = (lat: number | null, lon: number | null) =>
  lat !== null &&
  lon !== null &&
  lat >= 18 &&
  lat <= 72 &&
  lon >= -180 &&
  lon <= -60;

/** Locks today's two pins. The database re-checks the date, the noon cutoff and ownership. */
export async function lockGuess(
  _: LockState,
  fd: FormData,
): Promise<LockState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to play." };
  if (!roundOpen()) return { error: "Today's round closed at noon Eastern." };
  const lat = num(fd, "lat");
  const lon = num(fd, "lon");
  const quiet = fd.get("quiet") === "on";
  const tlat = quiet ? null : num(fd, "tlat");
  const tlon = quiet ? null : num(fd, "tlon");
  if (!inUS(lat, lon)) return { error: "Drop your severe pin inside the US." };
  if (!quiet && !inUS(tlat, tlon))
    return { error: "Drop your tornado pin, or call a quiet day." };
  const label = (k: string) => String(fd.get(k) ?? "").slice(0, 80) || null;
  const { error } = await supabase.from("game_guesses").insert({
    user_id: user.id,
    guess_date: gameDate(),
    lat,
    lon,
    city_label: label("label"),
    tor_lat: tlat,
    tor_lon: tlon,
    tor_city_label: quiet ? null : label("tlabel"),
  });
  if (error)
    return {
      error:
        error.code === "23505"
          ? "Your pins for today are already locked."
          : "Your pins couldn't be locked. Try again.",
    };
  revalidatePath("/wx-games");
  return { ok: true };
}
