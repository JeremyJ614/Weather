"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { gameDate } from "@/lib/game/score";

export type PollState = { ok?: string; error?: string } | null;

/** The Monday that starts the week containing `day` (YYYY-MM-DD). */
export async function mondayOf(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
const plus = (day: string, n: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);

function done(msg: string): PollState {
  revalidatePath("/admin/polls");
  revalidatePath("/weekly-polls");
  return { ok: msg };
}

/** Schedules a poll for a week (Monday–Sunday), or edits one that hasn't opened. */
export async function savePoll(_: PollState, fd: FormData): Promise<PollState> {
  const { supabase } = await requireAdmin("polls");
  const id = String(fd.get("id") ?? "");
  const question = String(fd.get("question") ?? "").trim();
  const note =
    String(fd.get("note") ?? "")
      .trim()
      .slice(0, 300) || null;
  const options = fd
    .getAll("option")
    .map((o) => String(o).trim().slice(0, 80))
    .filter(Boolean);
  const week = String(fd.get("week") ?? "");
  if (question.length < 8 || question.length > 200)
    return { error: "The question needs 8–200 characters." };
  if (options.length < 2 || options.length > 6)
    return { error: "Give 2–6 options." };
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length)
    return { error: "Each option must be different." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return { error: "Pick the week." };
  const starts_on = await mondayOf(week);
  const today = gameDate();
  if (plus(starts_on, 6) < today)
    return { error: "That week is already over." };
  const row = {
    question,
    options,
    note,
    starts_on,
    ends_on: plus(starts_on, 6),
  };

  if (/^[0-9a-f-]{36}$/.test(id)) {
    const { count } = await supabase
      .from("poll_votes")
      .select("id", { count: "exact", head: true })
      .eq("poll_id", id);
    if (count) return { error: "People have voted, so this poll is locked." };
    const { error } = await supabase.from("polls").update(row).eq("id", id);
    if (error) return { error: "That poll couldn't be saved." };
  } else {
    const { data: me } = await supabase.auth.getClaims();
    const { error } = await supabase
      .from("polls")
      .insert({ ...row, created_by: me?.claims.sub ?? null });
    if (error) return { error: "That poll couldn't be scheduled." };
  }
  await supabase.rpc("log_admin", {
    p_action: id ? "edit_poll" : "schedule_poll",
    p_target: question.slice(0, 120),
    p_detail: { starts_on },
  });
  return done(`Scheduled for the week of ${starts_on}.`);
}

export async function removePoll(fd: FormData) {
  const { supabase } = await requireAdmin("polls");
  const id = String(fd.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  const { data } = await supabase
    .from("polls")
    .delete()
    .eq("id", id)
    .select("question")
    .maybeSingle();
  if (data)
    await supabase.rpc("log_admin", {
      p_action: "remove_poll",
      p_target: data.question.slice(0, 120),
    });
  revalidatePath("/admin/polls");
  revalidatePath("/weekly-polls");
}
