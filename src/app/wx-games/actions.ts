"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { gameDate } from "@/lib/game/score";

export type SaveState = { error?: string; ok?: boolean } | null;

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

/** Saves (or moves) today's two pins. The database re-checks the date and ownership. */
export async function savePins(_: SaveState, fd: FormData): Promise<SaveState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to play." };
  const lat = num(fd, "lat");
  const lon = num(fd, "lon");
  const quiet = fd.get("quiet") === "on";
  const tlat = quiet ? null : num(fd, "tlat");
  const tlon = quiet ? null : num(fd, "tlon");
  if (!inUS(lat, lon)) return { error: "Drop your severe pin inside the US." };
  if (!quiet && !inUS(tlat, tlon))
    return { error: "Drop your tornado pin, or call a quiet day." };
  const label = (k: string) => String(fd.get(k) ?? "").slice(0, 80) || null;
  const { error } = await supabase.from("game_guesses").upsert(
    {
      user_id: user.id,
      guess_date: gameDate(),
      lat,
      lon,
      city_label: label("label"),
      tor_lat: tlat,
      tor_lon: tlon,
      tor_city_label: quiet ? null : label("tlabel"),
    },
    { onConflict: "user_id,guess_date" },
  );
  if (error) return { error: "Your pins couldn't be saved. Try again." };
  revalidatePath("/wx-games");
  return { ok: true };
}
