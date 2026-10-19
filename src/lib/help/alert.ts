import "server-only";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Where the owner hears about things that need them (also the storage watchdog's address). */
export const OWNER_EMAIL = "jaywx@yahoo.com";
const FROM = "StormSync Media <no-reply@send.sswx.space>";

/**
 * A form landed in admin → Contact inbox. Everyone who reads the inbox (the owner, and
 * admins given the Contact inbox) gets a pop-up notice in the app and a push to their
 * devices, and the owner gets an email with the whole message. Never throws: the message
 * is already saved, so a failed alert must not fail the form.
 */
export async function alertInbox(m: {
  form: string;
  name: string;
  email: string;
  subject: string;
  body: string;
}) {
  const db = supabaseAdmin();
  const title = `New message: ${m.form}`.slice(0, 80);
  const line = `${m.name}${m.subject ? ` · ${m.subject}` : ""}`.slice(0, 400);
  const jobs: Promise<unknown>[] = [];
  try {
    const [{ data: roles }, { data: perms }] = await Promise.all([
      db.from("user_roles").select("user_id").eq("role", "founder"),
      db.from("admin_permissions").select("user_id").eq("section", "inbox"),
    ]);
    const ids = [
      ...new Set([...(roles ?? []), ...(perms ?? [])].map((r) => r.user_id)),
    ];
    if (ids.length) {
      jobs.push(
        Promise.resolve(
          db.from("notifications").insert(
            ids.map((user_id) => ({
              user_id,
              level: "info",
              title,
              body: line,
            })),
          ),
        ),
      );
      const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const priv = process.env.VAPID_PRIVATE_KEY;
      if (pub && priv) {
        webpush.setVapidDetails("mailto:no-reply@send.sswx.space", pub, priv);
        const { data: subs } = await db
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .in("user_id", ids);
        for (const s of subs ?? [])
          jobs.push(
            webpush.sendNotification(
              {
                endpoint: s.endpoint,
                keys: { p256dh: s.p256dh, auth: s.auth },
              },
              JSON.stringify({
                title,
                body: line,
                url: "/admin/inbox",
                tag: "inbox",
              }),
              { TTL: 6 * 3600 },
            ),
          );
      }
    }
  } catch {}
  const key = process.env.RESEND_API_KEY;
  if (key)
    jobs.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM,
          to: OWNER_EMAIL,
          reply_to: m.email,
          subject: `${title}${m.subject ? `: ${m.subject}` : ""}`.slice(0, 150),
          text: [
            `From: ${m.name} <${m.email}>`,
            `Form: ${m.form}`,
            "",
            m.body,
            "",
            "Reply to this email to answer them, or open https://weather.sswx.space/admin/inbox",
          ].join("\n"),
        }),
        signal: AbortSignal.timeout(8000),
      }),
    );
  await Promise.allSettled(jobs);
}
