"use server";

import { getViewer } from "@/lib/auth/viewer";
import { supabaseServer } from "@/lib/supabase/server";

export type Notice = {
  id: string;
  level: "info" | "warning" | "alert";
  title: string;
  body: string;
};

/** The signed-in member's unread notices (none while viewing as a member). */
export async function myNotices(): Promise<Notice[]> {
  const viewer = await getViewer();
  if (!viewer.signedIn || viewer.lens) return [];
  const { data } = await (await supabaseServer()).rpc("my_notifications");
  return (data ?? []) as Notice[];
}

export async function seenNotice(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (user)
    await sb
      .from("notification_reads")
      .upsert({ user_id: user.id, notification_id: id });
}

/** Counts one page view for admin → Page usage (members only; not while viewing as). */
export async function trackView(slug: string) {
  const viewer = await getViewer();
  if (!viewer.signedIn || viewer.lens) return;
  await (
    await supabaseServer()
  ).rpc("track_view", { p_slug: slug.slice(0, 48) });
}
