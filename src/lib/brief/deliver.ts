import "server-only";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildBrief } from "./build";
import { briefText, isDue, type Brief } from "./compose";

const FROM = "StormSync Media <no-reply@send.sswx.space>";
const SITE = "https://weather.sswx.space";

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );

function emailHtml(b: Brief) {
  const t = briefText(b);
  return `<!doctype html><body style="margin:0;background:#0b0c14;color:#eceef5;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="color:#d9b76f;font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin:0">StormSync Daily Brief</p>
<h1 style="font-family:Georgia,serif;color:#d9b76f;margin:6px 0 16px">${esc(b.place)}</h1>
${t.lines.map((l) => `<p style="margin:0 0 10px;line-height:1.5">${esc(l)}</p>`).join("")}
<p style="margin:22px 0 0"><a href="${SITE}/daily-brief" style="color:#d9b76f">Open your brief</a> · <a href="${SITE}/daily-brief#settings" style="color:#8f92a8">Change or stop these emails</a></p>
</div></body>`;
}

type Sub = {
  user_id: string;
  label: string;
  lat: number;
  lon: number;
  time_zone: string;
  send_hour: number;
  by_email: boolean;
  by_push: boolean;
  last_sent: string | null;
};

/** Sends every brief that is due this hour. Runs hourly. */
export async function deliverBriefs(now = new Date()) {
  const db = supabaseAdmin();
  const { data: subs, error } = await db
    .from("brief_subscriptions")
    .select(
      "user_id, label, lat, lon, time_zone, send_hour, by_email, by_push, last_sent",
    )
    .or("by_email.eq.true,by_push.eq.true")
    .limit(2000);
  if (error) throw new Error(error.message);
  const due = (subs as Sub[])
    .map((s) => ({ s, ...isDue(s, now) }))
    .filter((x) => x.due);

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv)
    webpush.setVapidDetails("mailto:no-reply@send.sswx.space", pub, priv);
  const tally = { email: { sent: 0, failed: 0 }, push: { sent: 0, failed: 0 } };
  const briefs = new Map<string, Brief>();

  for (const { s, localDate } of due.slice(0, 200)) {
    const key = `${s.lat.toFixed(2)},${s.lon.toFixed(2)}`;
    let brief = briefs.get(key);
    if (!brief) {
      try {
        brief = { ...(await buildBrief(s.lat, s.lon)), place: s.label };
        briefs.set(key, brief);
      } catch {
        continue; // NWS down: try again next hour
      }
    }
    const text = briefText(brief);
    if (s.by_email && process.env.RESEND_API_KEY) {
      const { data } = await db.auth.admin.getUserById(s.user_id);
      const to = data.user?.email;
      const ok = to
        ? await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: FROM,
              to,
              subject: text.subject,
              html: emailHtml(brief),
              text: text.lines.join("\n"),
            }),
          }).then((r) => r.ok)
        : false;
      tally.email[ok ? "sent" : "failed"]++;
    }
    if (s.by_push && pub && priv) {
      const { data: endpoints } = await db
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", s.user_id);
      for (const e of endpoints ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: e.endpoint, keys: { p256dh: e.p256dh, auth: e.auth } },
            JSON.stringify({
              title: `Daily Brief · ${brief.place}`,
              body: text.push,
              url: "/daily-brief",
            }),
            { TTL: 3600 },
          );
          tally.push.sent++;
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410)
            await db
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", e.endpoint);
          tally.push.failed++;
        }
      }
    }
    await db
      .from("brief_subscriptions")
      .update({ last_sent: localDate })
      .eq("user_id", s.user_id);
  }

  const today = now.toISOString().slice(0, 10);
  for (const channel of ["email", "push"] as const) {
    const t = tally[channel];
    if (!t.sent && !t.failed) continue;
    const { data: row } = await db
      .from("brief_deliveries")
      .select("sent, failed")
      .eq("day", today)
      .eq("channel", channel)
      .maybeSingle();
    await db.from("brief_deliveries").upsert({
      day: today,
      channel,
      sent: (row?.sent ?? 0) + t.sent,
      failed: (row?.failed ?? 0) + t.failed,
    });
  }
  return { due: due.length, ...tally };
}
