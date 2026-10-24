import { supabaseAdmin } from "@/lib/supabase/admin";
import { OWNER_EMAIL } from "@/lib/help/alert";
import {
  assess,
  shouldAlert,
  utcMonth,
  type LastAlert,
} from "@/lib/ops/watchdog";

const FROM = "StormSync Media <no-reply@send.sswx.space>";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const mb = (n: number) => `${(n / 1024 ** 2).toFixed(1)} MB`;

/**
 * Daily (vercel.json): records database and storage size, prunes old rows, and emails the owner
 * at 60% and 80% of the free quota. Vercel signs the call with CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET is not set", { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = supabaseAdmin();
  const snap = await db.rpc("take_storage_snapshot");
  if (snap.error) {
    return Response.json({ error: snap.error.message }, { status: 500 });
  }
  // Retention (storage safety rule 2): snapshots 400 days, map-load months 24 months,
  // idle PIN lockout rows 30 days, audit log 1 year, error groups 30 days,
  // story pins/hides 30 days, sent alerts 30 days, declined Disaster Response sign-ups 30
  // days after the decision.
  const day = (n: number) =>
    new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  // Members' outdoor reports keep a year; their photos go with them.
  const old = await db
    .from("outdoor_reports")
    .select("photo")
    .lt("at", day(365))
    .not("photo", "is", null)
    .limit(1000);
  const photos = (old.data ?? []).map((r) => r.photo as string);
  if (photos.length) await db.storage.from("outdoor").remove(photos);
  const pruned = await Promise.all([
    db.from("outdoor_reports").delete().lt("at", day(365)),
    db.from("storage_snapshots").delete().lt("day", day(400)),
    db.from("map_load_months").delete().lt("month", day(731)),
    db.from("pin_attempts").delete().lt("updated_at", day(30)),
    db.from("audit_log").delete().lt("at", day(365)),
    db.from("client_errors").delete().lt("last_seen", day(30)),
    db.from("news_curation").delete().lt("created_at", day(30)),
    db.from("brief_deliveries").delete().lt("day", day(90)),
    db.from("notify_sent").delete().lt("sent_at", day(30)),
    db.from("afd_simplified").delete().lt("created_at", day(7)),
    db.from("notifications").delete().lt("created_at", day(90)),
    db.from("contact_messages").delete().lt("created_at", day(365)),
    db.from("page_views").delete().lt("day", day(180)),
    db.from("chase_days").delete().lt("day", day(1100)),
    db.from("game_guesses").delete().lt("guess_date", day(731)),
    db.from("game_points").delete().lt("earned_on", day(731)),
    db.from("trivia_answers").delete().lt("answered_at", day(731)),
    db.from("weatherdle_plays").delete().lt("day", day(731)),
    db.from("poll_votes").delete().lt("voted_at", day(731)),
    db.from("sswxcon_snapshots").delete().lt("at", day(30)),
    db.from("ai_usage").delete().lt("day", day(90)),
    db.from("donations").delete().lt("created_at", day(2557)),
    db
      .from("disaster_orgs")
      .delete()
      .eq("status", "declined")
      .lt("reviewed_at", day(30)),
  ]);
  const pruneError = pruned.find((r) => r.error)?.error;
  if (pruneError) {
    return Response.json({ error: pruneError.message }, { status: 500 });
  }

  const latest = await db
    .from("storage_snapshots")
    .select("db_bytes, storage_bytes")
    .order("day", { ascending: false })
    .limit(1)
    .single();
  if (latest.error) {
    return Response.json({ error: latest.error.message }, { status: 500 });
  }

  const { db_bytes, storage_bytes } = latest.data;
  const usage = assess(db_bytes, storage_bytes);
  const month = utcMonth();
  const prev = await db
    .from("app_config")
    .select("value")
    .eq("key", "storage_alert")
    .maybeSingle();
  const last = (prev.data?.value ?? null) as LastAlert;

  let emailed = false;
  if (shouldAlert(last, usage.level, month)) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      return Response.json(
        { ...usage, error: "RESEND_API_KEY is not set" },
        { status: 500 },
      );
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: OWNER_EMAIL,
        subject: `Storage ${usage.level === "critical" ? "at 80%" : "at 60%"}: StormSync Weather`,
        text: [
          `Database: ${mb(db_bytes)} (${pct(usage.dbPct)} of the free 500 MB)`,
          `File storage: ${mb(storage_bytes)} (${pct(usage.storagePct)} of the free 1 GB)`,
          "",
          "Nothing is broken yet. Check the storage watchdog in the admin panel to see which table is growing.",
        ].join("\n"),
      }),
    });
    if (!res.ok) {
      return Response.json(
        { ...usage, error: `Email failed: ${res.status}` },
        { status: 502 },
      );
    }
    await db
      .from("app_config")
      .upsert({ key: "storage_alert", value: { month, level: usage.level } });
    emailed = true;
  }

  return Response.json({ ...usage, emailed });
}
