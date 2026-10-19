import "server-only";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { activeAlerts, alertsAt, type NwsFeature } from "@/lib/nws/active";
import { kp } from "@/lib/aurora/data";
import { kpNeeded } from "@/lib/aurora/style";
import { getOutlook } from "@/lib/tropical/nhc";
import { BANDS, bandFor } from "@/lib/sswxcon/score";
import { gameDate } from "@/lib/game/score";
import { getSiteDefaults } from "@/lib/settings";
import { isQuiet, topicOf, type TopicId } from "./topics";

type Pref = {
  user_id: string;
  topics: string[];
  label: string | null;
  lat: number | null;
  lon: number | null;
  quiet_from: number | null;
  quiet_to: number | null;
  time_zone: string | null;
};
export type Note = {
  user_id: string;
  topic: TopicId;
  key: string;
  title: string;
  body: string;
  url: string;
};
type Geometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
const SPC_ORDER = ["TSTM", "MRGL", "SLGT", "ENH", "MDT", "HIGH"];
const SIGNIFICANT = BANDS.findIndex((b) => b.label === "Significant");
const cut = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;
const place = (p: Pref) => p.label || "your place";

/** Odd-even ray test across every ring, so holes count as outside. */
export function inside(g: Geometry, lon: number, lat: number) {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  let hit = false;
  for (const rings of polys)
    for (const ring of rings)
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (
          yi > lat !== yj > lat &&
          lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
        )
          hit = !hit;
      }
  return hit;
}

/** One NWS event across its updates: office, phenomenon, significance and number from VTEC. */
export function eventKey(f: NwsFeature) {
  const v = f.properties.parameters?.VTEC?.[0]?.split(".");
  return v && v.length > 6
    ? { key: `${v[2]}.${v[3]}.${v[4]}.${v[5]}`, action: v[1] }
    : { key: f.properties.id.slice(-60), action: "NEW" };
}

async function local(prefs: Pref[], notes: Note[]) {
  const subs = prefs.filter(
    (p) =>
      p.lat != null &&
      p.lon != null &&
      (p.topics.includes("warnings") || p.topics.includes("watches")),
  );
  if (!subs.length) return;
  const byId = new Map((await activeAlerts()).map((f) => [f.properties.id, f]));
  // Members in the same spot share one NWS point request.
  const spots = new Map<string, Pref[]>();
  for (const p of subs) {
    const k = `${p.lat!.toFixed(2)},${p.lon!.toFixed(2)}`;
    spots.set(k, [...(spots.get(k) ?? []), p]);
  }
  const list = [...spots.values()].slice(0, 200);
  for (let i = 0; i < list.length; i += 6)
    await Promise.all(
      list.slice(i, i + 6).map(async (group) => {
        const ids = await alertsAt(group[0].lat!, group[0].lon!).catch(
          () => [],
        );
        for (const id of ids) {
          const f = byId.get(id);
          if (!f) continue;
          const ev = f.properties.event;
          const topic = /Warning$/.test(ev)
            ? "warnings"
            : /Watch$/.test(ev)
              ? "watches"
              : null;
          const { key, action } = eventKey(f);
          if (!topic || action === "CAN" || action === "EXP") continue;
          for (const p of group)
            if (p.topics.includes(topic))
              notes.push({
                user_id: p.user_id,
                topic,
                key,
                title: ev,
                body: cut(`${place(p)}: ${f.properties.headline ?? ev}`, 300),
                url: "/warnings-reports",
              });
        }
      }),
    );
}

/** Highest key level already sent per member for keys starting with `prefix`. */
async function sentLevels(topic: TopicId, prefix: string, users: string[]) {
  const best = new Map<string, number>();
  if (!users.length) return best;
  const { data } = await supabaseAdmin()
    .from("notify_sent")
    .select("user_id, key")
    .eq("topic", topic)
    .like("key", `${prefix}%`)
    .in("user_id", users);
  for (const r of data ?? []) {
    const lvl = Number(String(r.key).split(":").pop());
    best.set(r.user_id, Math.max(best.get(r.user_id) ?? -1, lvl));
  }
  return best;
}

async function spc(prefs: Pref[], notes: Note[]) {
  const subs = prefs.filter(
    (p) => p.topics.includes("spc") && p.lat != null && p.lon != null,
  );
  if (!subs.length) return;
  const r = await fetch(
    "https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson",
    { headers: UA, cache: "no-store", signal: AbortSignal.timeout(15000) },
  );
  if (!r.ok) throw new Error(`SPC ${r.status}`);
  const d = (await r.json()) as {
    features: {
      geometry: Geometry | null;
      properties: { LABEL?: string; LABEL2?: string; VALID?: string };
    }[];
  };
  const day = String(d.features[0]?.properties.VALID ?? "").slice(0, 8);
  if (!/^\d{8}$/.test(day)) return;
  const prior = await sentLevels(
    "spc",
    `${day}:`,
    subs.map((p) => p.user_id),
  );
  for (const p of subs) {
    let lvl = -1;
    let name = "";
    for (const f of d.features) {
      const k = SPC_ORDER.indexOf(String(f.properties.LABEL));
      if (k > lvl && f.geometry && inside(f.geometry, p.lon!, p.lat!)) {
        lvl = k;
        name = f.properties.LABEL2 || String(f.properties.LABEL);
      }
    }
    // Marginal and up; general thunder alone isn't a risk worth a ping.
    if (lvl < 1 || lvl <= (prior.get(p.user_id) ?? 0)) continue;
    const raised = prior.has(p.user_id);
    notes.push({
      user_id: p.user_id,
      topic: "spc",
      key: `${day}:${lvl}`,
      title: raised ? `Raised to ${name}` : `SPC ${name}`,
      body: `${place(p)} is in SPC's ${name} for today${raised ? ", up from earlier" : ""}.`,
      url: "/spc-probability",
    });
  }
}

async function engines(prefs: Pref[], notes: Note[]) {
  const subs = prefs.filter((p) => p.topics.includes("engines"));
  if (!subs.length) return;
  const { data } = await supabaseAdmin()
    .from("sswxcon_snapshots")
    .select("at, total")
    .order("at", { ascending: false })
    .limit(1);
  const snap = data?.[0];
  if (!snap || Date.now() - Date.parse(snap.at) > 2 * 3600_000) return;
  const band = bandFor(snap.total);
  const lvl = BANDS.indexOf(band);
  if (lvl < SIGNIFICANT) return;
  const day = gameDate(new Date(snap.at));
  const prior = await sentLevels(
    "engines",
    `${day}:`,
    subs.map((p) => p.user_id),
  );
  for (const p of subs)
    if (lvl > (prior.get(p.user_id) ?? -1))
      notes.push({
        user_id: p.user_id,
        topic: "engines",
        key: `${day}:${lvl}`,
        title: `SSWXCon: ${band.label}`,
        body: `The national severe weather score is ${Math.round(snap.total)}.`,
        url: "/sswxcon",
      });
}

/** Published stories and the team's notices (to everyone, or to that member). */
async function news(prefs: Pref[], notes: Note[]) {
  const subs = prefs.filter((p) => p.topics.includes("news"));
  if (!subs.length) return;
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const now = new Date().toISOString();
  const [posts, notices] = await Promise.all([
    db
      .from("news_posts")
      .select("id, title")
      .eq("status", "published")
      .gte("publish_at", since)
      .lte("publish_at", now)
      .limit(10),
    db
      .from("notifications")
      .select("id, user_id, title, body")
      .gte("created_at", since)
      .limit(50),
  ]);
  for (const p of subs) {
    for (const n of posts.data ?? [])
      notes.push({
        user_id: p.user_id,
        topic: "news",
        key: `post:${n.id}`,
        title: "SSWX News",
        body: cut(n.title, 300),
        url: `/news/${n.id}`,
      });
    for (const n of notices.data ?? [])
      if (!n.user_id || n.user_id === p.user_id)
        notes.push({
          user_id: p.user_id,
          topic: "news",
          key: `notice:${n.id}`,
          title: cut(n.title, 120),
          body: cut(n.body || "From the StormSync team.", 300),
          url: "/notifications",
        });
  }
}

async function tropical(prefs: Pref[], notes: Note[]) {
  const subs = prefs.filter((p) => p.topics.includes("tropical"));
  if (!subs.length) return;
  const { storms } = await getOutlook();
  for (const s of storms)
    for (const p of subs)
      notes.push({
        user_id: p.user_id,
        topic: "tropical",
        key: cut(`${s.id}:${s.tier}`, 120),
        title: s.title,
        body: `${s.tier}, ${s.mph} mph winds${s.pressure ? `, ${s.pressure} mb` : ""}.`,
        url: "/tropical-outlook",
      });
}

async function aurora(prefs: Pref[], notes: Note[]) {
  const subs = prefs.filter(
    (p) => p.topics.includes("aurora") && p.lat != null,
  );
  if (!subs.length) return;
  const { bars } = await kp();
  const soon = Date.now() + 24 * 3600_000;
  const peak = bars
    .filter((b) => b.kind === "predicted" && Date.parse(b.at) <= soon)
    .reduce((m, b) => Math.max(m, b.kp), 0);
  const day = gameDate();
  for (const p of subs) {
    const need = kpNeeded(p.lat!);
    if (need == null || peak < need) continue;
    notes.push({
      user_id: p.user_id,
      topic: "aurora",
      key: day,
      title: "Aurora possible",
      body: `Kp ${peak} is forecast in the next day; ${place(p)} needs about Kp ${need}.`,
      url: "/aurora-center",
    });
  }
}

async function games(prefs: Pref[], notes: Note[]) {
  const want = (t: string) => prefs.filter((p) => p.topics.includes(t));
  const db = supabaseAdmin();
  const today = gameDate();
  const yesterday = gameDate(new Date(Date.now() - 864e5));
  const g = want("game");
  if (g.length) {
    const { data } = await db
      .from("game_points")
      .select("id, user_id, points, earned_on")
      .eq("source", "forecast_game")
      .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString())
      .in(
        "user_id",
        g.map((p) => p.user_id),
      );
    for (const r of data ?? [])
      notes.push({
        user_id: r.user_id,
        topic: "game",
        key: `fg:${r.id}`,
        title: "Forecast game scored",
        body: `You earned ${r.points} points for ${r.earned_on}.`,
        url: "/wx-games",
      });
  }
  const t = want("trivia");
  if (t.length) {
    const { data } = await db
      .from("trivia_questions")
      .select("id")
      .eq("ask_date", today)
      .eq("active", true)
      .limit(1);
    if (data?.length)
      for (const p of t)
        notes.push({
          user_id: p.user_id,
          topic: "trivia",
          key: today,
          title: "Today's trivia is ready",
          body: "New questions are up. Answer them for points.",
          url: "/wx-games",
        });
  }
  const v = want("polls");
  if (v.length) {
    const { data } = await db
      .from("polls")
      .select("id, question")
      .gte("starts_on", yesterday)
      .lte("starts_on", today)
      .limit(3);
    for (const poll of data ?? [])
      for (const p of v)
        notes.push({
          user_id: p.user_id,
          topic: "polls",
          key: poll.id,
          title: "New weekly poll",
          body: cut(poll.question, 300),
          url: "/weekly-polls",
        });
  }
}

/**
 * Records each new alert once (the log's primary key decides what is new) and pushes it
 * to the member's devices. Push services that say a device is gone lose its endpoint.
 */
export async function send(notes: Note[]) {
  const db = supabaseAdmin();
  const tally = { new: 0, pushed: 0, failed: 0, gone: 0 };
  if (!notes.length) return tally;
  const { data: fresh, error } = await db
    .from("notify_sent")
    .upsert(notes.slice(0, 1000), {
      onConflict: "user_id,topic,key",
      ignoreDuplicates: true,
    })
    .select("user_id, topic, key, title, body, url");
  if (error) throw new Error(error.message);
  tally.new = fresh?.length ?? 0;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!fresh?.length || !pub || !priv) return tally;
  webpush.setVapidDetails("mailto:no-reply@send.sswx.space", pub, priv);
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("endpoint, user_id, p256dh, auth")
    .in("user_id", [...new Set(fresh.map((n) => n.user_id))]);
  const pushed: Note[] = [];
  for (const n of fresh) {
    let ok = false;
    for (const s of subs ?? []) {
      if (s.user_id !== n.user_id) continue;
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({
            title: n.title,
            body: n.body,
            url: n.url,
            tag: `${n.topic}:${n.key}`,
          }),
          { TTL: topicOf(n.topic)?.urgent ? 3600 : 6 * 3600 },
        );
        ok = true;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          tally.gone++;
          await db
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", s.endpoint);
        } else tally.failed++;
      }
    }
    if (ok) pushed.push(n as Note);
  }
  tally.pushed = pushed.length;
  await Promise.all(
    pushed.map((n) =>
      db
        .from("notify_sent")
        .update({ pushed: true })
        .eq("user_id", n.user_id)
        .eq("topic", n.topic)
        .eq("key", n.key),
    ),
  );
  return tally;
}

/** Every 10 minutes: gather what's new for each topic, hold the quiet ones, send the rest. */
export async function runNotify(now = new Date()) {
  // The admin kill switch (Admin → Ops) pauses delivery without losing anything new.
  if ((await getSiteDefaults()).disabled.includes("notify"))
    return { paused: true };
  const { data, error } = await supabaseAdmin()
    .from("notify_prefs")
    .select("user_id, topics, label, lat, lon, quiet_from, quiet_to, time_zone")
    .neq("topics", "{}")
    .limit(5000);
  if (error) throw new Error(error.message);
  const prefs = (data ?? []) as Pref[];
  if (!prefs.length) return { members: 0 };
  const notes: Note[] = [];
  const errors: string[] = [];
  const steps = { local, spc, engines, news, tropical, aurora, games };
  await Promise.all(
    Object.entries(steps).map(([name, fn]) =>
      fn(prefs, notes).catch((e: Error) =>
        errors.push(`${name}: ${e.message}`),
      ),
    ),
  );
  // Quiet hours hold everything but warnings and watches until they end.
  const quiet = new Set(
    prefs.filter((p) => isQuiet(p, now)).map((p) => p.user_id),
  );
  const due = notes.filter(
    (n) => topicOf(n.topic)?.urgent || !quiet.has(n.user_id),
  );
  return {
    members: prefs.length,
    found: notes.length,
    held: notes.length - due.length,
    ...(await send(due)),
    errors,
  };
}
