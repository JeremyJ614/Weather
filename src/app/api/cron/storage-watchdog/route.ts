import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  assess,
  shouldAlert,
  utcMonth,
  type LastAlert,
} from "@/lib/ops/watchdog";

const OWNER_EMAIL = "jaywx@yahoo.com";
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
  // Retention (storage safety rule 2): snapshots 400 days, map-load months 24 months.
  const day = (n: number) =>
    new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const pruned = await Promise.all([
    db.from("storage_snapshots").delete().lt("day", day(400)),
    db.from("map_load_months").delete().lt("month", day(731)),
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
