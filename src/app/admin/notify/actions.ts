"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";

export type NotifyState = { error?: string; ok?: string } | null;
const LEVELS = ["info", "warning", "alert"];

/** Sends an in-app notice to every member or one member. */
export async function sendNotice(
  _: NotifyState,
  fd: FormData,
): Promise<NotifyState> {
  const { supabase, viewer } = await requireAdmin("notify");
  const s = (k: string, n: number) =>
    String(fd.get(k) ?? "")
      .trim()
      .slice(0, n);
  const level = s("level", 10);
  const title = s("title", 80);
  const to = s("to", 36);
  if (!LEVELS.includes(level)) return { error: "Pick a level." };
  if (!title) return { error: "Give it a title." };
  if (to && !/^[0-9a-f-]{36}$/.test(to)) return { error: "Pick a member." };
  const { error } = await supabase.from("notifications").insert({
    user_id: to || null,
    level,
    title,
    body: s("body", 400),
    sent_by: viewer.id,
  });
  if (error) return { error: "It couldn't be sent. Try again." };
  await supabase.rpc("log_admin", {
    p_action: "send_notice",
    p_target: title,
    p_detail: { to: to || "everyone", level },
  });
  revalidatePath("/admin/notify");
  return {
    ok: to
      ? "Sent. They'll see it next time they open the app."
      : "Sent to every member.",
  };
}

export async function removeNotice(id: string) {
  const { supabase } = await requireAdmin("notify");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await supabase.from("notifications").delete().eq("id", id);
  revalidatePath("/admin/notify");
}
