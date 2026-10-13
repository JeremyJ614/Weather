"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { gameDate } from "@/lib/game/score";

export type AdminState = { ok?: string; error?: string } | null;

const UUID = /^[0-9a-f-]{36}$/;
const text = (fd: FormData, k: string, max = 60) =>
  String(fd.get(k) ?? "")
    .trim()
    .slice(0, max);

function done(msg: string): AdminState {
  revalidatePath("/admin/leaderboard");
  revalidatePath("/leaderboard");
  return { ok: msg };
}

/** Member lookup for the pickers (admins only, enforced by the RPC). */
export async function findMembers(q: string) {
  const { supabase } = await requireAdmin("leaderboard");
  const term = q.trim().slice(0, 40);
  if (term.length < 1) return [];
  const { data } = await supabase.rpc("game_members", { p_q: term });
  return (data ?? []) as { user_id: string; name: string }[];
}

/** Adds (or, with a negative number, removes) points for one member. */
export async function adjustPoints(
  _: AdminState,
  fd: FormData,
): Promise<AdminState> {
  const { supabase, viewer } = await requireAdmin("leaderboard");
  const user = text(fd, "user_id", 36);
  const name = text(fd, "name");
  const points = Math.trunc(Number(fd.get("points")));
  const note = text(fd, "note", 140);
  const on = text(fd, "on", 10) || gameDate();
  if (!UUID.test(user)) return { error: "Pick a member." };
  if (!Number.isFinite(points) || points === 0 || Math.abs(points) > 100_000)
    return { error: "Enter points between -100,000 and 100,000 (not 0)." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) return { error: "Pick a valid date." };
  if (!note) return { error: "Add a short reason; members may ask." };
  const { error } = await supabase.from("game_points").insert({
    user_id: user,
    source: "admin",
    points,
    earned_on: on,
    detail: { note, name, by: viewer.name },
  });
  if (error) return { error: "That adjustment couldn't be saved." };
  await supabase.rpc("log_admin", {
    p_action: "adjust_points",
    p_target: name,
    p_detail: { points, on, note },
  });
  return done(
    `${points > 0 ? "Added" : "Removed"} ${Math.abs(points).toLocaleString()} points ${points > 0 ? "for" : "from"} ${name}.`,
  );
}

/** Enters or corrects a monthly or yearly champion (members or past names). */
export async function saveTitle(
  _: AdminState,
  fd: FormData,
): Promise<AdminState> {
  const { supabase, viewer } = await requireAdmin("leaderboard");
  const kind = fd.get("kind") === "year" ? "year" : "month";
  const period = text(fd, kind === "year" ? "year" : "month", 7);
  const user = text(fd, "user_id", 36);
  const name = text(fd, "name");
  const raw = String(fd.get("points") ?? "").trim();
  const points = raw ? Math.trunc(Number(raw)) : null;
  const ok =
    kind === "year"
      ? /^\d{4}$/.test(period)
      : /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
  if (!ok) return { error: `Pick the ${kind}.` };
  if (period > gameDate().slice(0, kind === "year" ? 4 : 7))
    return { error: "That period hasn't happened yet." };
  if (!UUID.test(user) && !name)
    return { error: "Pick a member or type the champion's name." };
  if (points !== null && !Number.isFinite(points))
    return { error: "Points must be a number." };
  const { data: me } = await supabase.auth.getClaims();
  const { error } = await supabase.from("game_titles").upsert(
    {
      kind,
      period,
      user_id: UUID.test(user) ? user : null,
      name: UUID.test(user) ? null : name,
      points,
      entered_by: me?.claims.sub ?? null,
    },
    { onConflict: "kind,period" },
  );
  if (error) return { error: "That champion couldn't be saved." };
  await supabase.rpc("log_admin", {
    p_action: "save_champion",
    p_target: `${kind} ${period}`,
    p_detail: { name, points, by: viewer.name },
  });
  return done(`Saved the ${period} champion.`);
}

export async function removeTitle(fd: FormData) {
  const { supabase } = await requireAdmin("leaderboard");
  const kind = fd.get("kind") === "year" ? "year" : "month";
  const period = text(fd, "period", 7);
  const { error } = await supabase
    .from("game_titles")
    .delete()
    .eq("kind", kind)
    .eq("period", period);
  if (!error)
    await supabase.rpc("log_admin", {
      p_action: "remove_champion",
      p_target: `${kind} ${period}`,
    });
  revalidatePath("/admin/leaderboard");
  revalidatePath("/leaderboard");
}
