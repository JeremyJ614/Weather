"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { gameDate } from "@/lib/game/score";
import { checkWord } from "@/lib/weatherdle/words";

export type SaveState = { error?: string; saved?: string } | null;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const done = () => {
  revalidatePath("/admin/weatherdle");
  revalidatePath("/wx-games");
};

/** Hints on or off for everyone (the hint costs a quarter of a solve's points). */
export async function setHints(on: boolean): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin("weatherdle");
  const { error } = await supabase
    .from("app_config")
    .update({ value: { hints: on }, updated_at: new Date().toISOString() })
    .eq("key", "weatherdle_settings");
  if (error) return { error: "Couldn't save. Try again." };
  await supabase.rpc("log_admin", {
    p_action: on ? "weatherdle_hints_on" : "weatherdle_hints_off",
    p_target: "weatherdle",
    p_detail: {},
  });
  done();
  return {};
}

/** Sets the word for a day: today (until someone has played it) or any day ahead. */
export async function saveWord(_: SaveState, fd: FormData): Promise<SaveState> {
  const { supabase } = await requireAdmin("weatherdle");
  const day = String(fd.get("day") ?? "");
  const today = gameDate();
  if (!DAY.test(day) || day < today)
    return { error: "Pick today or a day ahead." };
  const pick = checkWord(fd.get("word"), fd.get("hint"));
  if (!pick)
    return {
      error:
        "Use one word of 3 to 14 letters, and a hint of at least a few words that doesn't name it.",
    };
  if (day === today) {
    const { count } = await supabase
      .from("weatherdle_plays")
      .select("day", { count: "exact", head: true })
      .eq("day", today);
    if (count)
      return {
        error: `${count} ${count === 1 ? "member has" : "members have"} already played today's word, so it stays. Set yours for tomorrow or later.`,
      };
  }
  const { error } = await supabase
    .from("weatherdle_words")
    .upsert({ day, ...pick, source: "admin" }, { onConflict: "day" });
  if (error) return { error: "Couldn't save. Try again." };
  await supabase.rpc("log_admin", {
    p_action: "weatherdle_word",
    p_target: day,
    p_detail: { length: pick.word.length },
  });
  done();
  return { saved: `${pick.word} is set for ${day}.` };
}

/** Clears a future day's word, so the daily pick fills it instead. */
export async function clearWord(day: string): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin("weatherdle");
  if (!DAY.test(day) || day <= gameDate())
    return { error: "Only a day ahead can be cleared." };
  const { error } = await supabase
    .from("weatherdle_words")
    .delete()
    .eq("day", day);
  if (error) return { error: "Couldn't clear it. Try again." };
  done();
  return {};
}
