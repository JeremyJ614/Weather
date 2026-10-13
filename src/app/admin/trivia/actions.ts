"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { draftQuestion, type Category } from "@/lib/trivia/generate";
import { cleanDraft, type Draft } from "@/lib/trivia/shape";

export type TriviaState = { ok?: string; error?: string } | null;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/;

/** Reads the shared question form into a checked row. */
function read(fd: FormData) {
  const choices = fd
    .getAll("choice")
    .map((c) => String(c).trim())
    .filter(Boolean);
  const draft = cleanDraft({
    question: fd.get("question"),
    choices,
    answer_index: Number(fd.get("answer")),
    explanation: fd.get("explanation"),
  });
  const points = Math.trunc(Number(fd.get("points")));
  const category = fd.get("category") === "random" ? "random" : "weather";
  if (!draft)
    return {
      error:
        "Check the question: 8–300 characters, 2–6 different choices, and one marked correct.",
    } as const;
  if (!Number.isFinite(points) || points < 0 || points > 10_000)
    return { error: "Points must be between 0 and 10,000." } as const;
  return {
    row: {
      ...draft,
      category,
      points,
      bonus: fd.get("bonus") === "on",
      active: fd.get("active") !== "off",
    },
  } as const;
}

function done(day: string, msg: string): TriviaState {
  revalidatePath("/admin/trivia");
  revalidatePath("/wx-games");
  return { ok: msg };
}

export async function saveQuestion(
  _: TriviaState,
  fd: FormData,
): Promise<TriviaState> {
  const { supabase } = await requireAdmin("trivia");
  const id = String(fd.get("id") ?? "");
  const day = String(fd.get("day") ?? "");
  const r = read(fd);
  if ("error" in r) return { error: r.error };
  if (UUID.test(id)) {
    const { error } = await supabase
      .from("trivia_questions")
      .update({ ...r.row, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { error: "That question couldn't be saved." };
    await supabase.rpc("log_admin", {
      p_action: "edit_trivia",
      p_target: r.row.question.slice(0, 120),
      p_detail: { points: r.row.points, bonus: r.row.bonus, day },
    });
    return done(day, "Saved.");
  }
  if (!DAY.test(day)) return { error: "Pick a date." };
  const { data: taken } = await supabase
    .from("trivia_questions")
    .select("slot")
    .eq("ask_date", day);
  const used = new Set((taken ?? []).map((x) => x.slot));
  // Slots 1 and 2 belong to the daily AI pair; admin additions start at 3.
  let slot = 3;
  while (used.has(slot) && slot <= 20) slot++;
  if (slot > 20) return { error: "That day already has 20 questions." };
  const { error } = await supabase
    .from("trivia_questions")
    .insert({ ...r.row, ask_date: day, slot, source: "admin" });
  if (error) return { error: "That question couldn't be added." };
  await supabase.rpc("log_admin", {
    p_action: "add_trivia",
    p_target: r.row.question.slice(0, 120),
    p_detail: { points: r.row.points, bonus: r.row.bonus, day },
  });
  return done(day, "Question added.");
}

export async function removeQuestion(fd: FormData) {
  const { supabase } = await requireAdmin("trivia");
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) return;
  const { data } = await supabase
    .from("trivia_questions")
    .delete()
    .eq("id", id)
    .select("question")
    .maybeSingle();
  if (data)
    await supabase.rpc("log_admin", {
      p_action: "remove_trivia",
      p_target: data.question.slice(0, 120),
    });
  revalidatePath("/admin/trivia");
  revalidatePath("/wx-games");
}

/** A fresh Gemini draft for the admin to review before saving. */
export async function aiDraft(
  category: Category,
): Promise<Draft | { error: string }> {
  await requireAdmin("trivia");
  try {
    return await draftQuestion(category === "random" ? "random" : "weather");
  } catch (e) {
    return { error: (e as Error).message };
  }
}
