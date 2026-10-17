"use server";

import webpush from "web-push";
import { supabaseServer } from "@/lib/supabase/server";
import { TOPIC_IDS, isTopic } from "@/lib/notify/topics";

export type AlertsInput = {
  topics: string[];
  place: { label: string; lat: number; lon: number } | null;
  quiet: { from: number; to: number } | null;
  timeZone: string;
};

const hour = (n: unknown) =>
  Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 23;

/** Saves the member's alert choices (their own row; row level security checks it). */
export async function saveAlerts(
  input: AlertsInput,
): Promise<{ error?: string }> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to save." };
  const topics = [...new Set(input.topics)].filter(isTopic);
  if (topics.length > TOPIC_IDS.length) return { error: "Bad request." };
  const p = input.place;
  const placeOk =
    p &&
    typeof p.label === "string" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lon) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lon) <= 180;
  const q = input.quiet;
  const quietOk = q && hour(q.from) && hour(q.to);
  let tz: string | null = null;
  try {
    tz = new Intl.DateTimeFormat("en-US", {
      timeZone: input.timeZone,
    }).resolvedOptions().timeZone;
  } catch {}
  const { error } = await supabase.from("notify_prefs").upsert({
    user_id: user.id,
    topics,
    label: placeOk ? p.label.slice(0, 80) : null,
    lat: placeOk ? p.lat : null,
    lon: placeOk ? p.lon : null,
    quiet_from: quietOk ? q.from : null,
    quiet_to: quietOk ? q.to : null,
    time_zone: tz,
    updated_at: new Date().toISOString(),
  });
  return error ? { error: "Couldn't save. Try again." } : {};
}

/** Sends a test notification to every device on the member's account. */
export async function testPush(): Promise<{ sent?: number; error?: string }> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv)
    return { error: "Notifications aren't set up on this server." };
  webpush.setVapidDetails("mailto:no-reply@send.sswx.space", pub, priv);
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id);
  let sent = 0;
  for (const s of subs ?? [])
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({
          title: "StormSync test",
          body: "Notifications are working on this device.",
          url: "/notifications",
          tag: "test",
        }),
        { TTL: 300 },
      );
      sent++;
    } catch {}
  return sent ? { sent } : { error: "No device answered. Turn them on again." };
}
