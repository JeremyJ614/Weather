"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export type BriefState = { error?: string; saved?: string } | null;

const validTz = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz.length <= 60;
  } catch {
    return false;
  }
};

export async function saveBrief(
  _: BriefState,
  fd: FormData,
): Promise<BriefState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to get the brief delivered." };
  const label = String(fd.get("label") ?? "").slice(0, 80);
  const lat = Number(fd.get("lat"));
  const lon = Number(fd.get("lon"));
  const tz = String(fd.get("tz") ?? "");
  const hour = Number(fd.get("hour"));
  const byEmail = fd.get("email") === "on";
  const byPush = fd.get("push") === "on";
  const byText = fd.get("text") === "on";
  if (!label || !Number.isFinite(lat) || !Number.isFinite(lon))
    return { error: "Pick a place first." };
  if (!validTz(tz))
    return { error: "That place's time zone wasn't recognized." };
  if (!Number.isInteger(hour) || hour < 0 || hour > 23)
    return { error: "Pick a time." };
  if (byText) {
    const { data: p } = await supabase
      .from("profiles")
      .select("phone")
      .maybeSingle();
    if (!p?.phone)
      return { error: "Add a phone number to your profile to get texts." };
  }
  const { error } = await supabase.from("brief_subscriptions").upsert({
    user_id: user.id,
    label,
    lat,
    lon,
    time_zone: tz,
    send_hour: hour,
    by_email: byEmail,
    by_push: byPush,
    by_text: byText,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Couldn't save. Try again." };
  revalidatePath("/daily-brief");
  const how = [byEmail && "email", byPush && "notification", byText && "text"]
    .filter(Boolean)
    .join(", ");
  return {
    saved: how
      ? `Saved. Your brief comes by ${how} at ${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}.`
      : "Saved, with no delivery chosen.",
  };
}

export async function stopBrief(): Promise<BriefState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };
  await supabase.from("brief_subscriptions").delete().eq("user_id", user.id);
  revalidatePath("/daily-brief");
  return { saved: "Delivery stopped." };
}
