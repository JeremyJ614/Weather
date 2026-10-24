import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildDay, type OtdData } from "./onthisday";
import { writeStory, type OtdStory } from "./story";

export type HistoryDay = {
  md: string;
  data: OtdData;
  story: OtdStory | null;
  updated_at: string;
};

const MD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const validMd = (s: string | null | undefined) =>
  !!s && MD.test(s) && !Number.isNaN(Date.parse(`2024-${s}T12:00:00Z`));

/** Today's month and day in Central time, the site's convention. */
export const todayMd = (at = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    month: "2-digit",
    day: "2-digit",
  })
    .format(at)
    .replace("/", "-");

/** A stored date, read with the public key through the data cache. */
export async function readDay(md: string): Promise<HistoryDay | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const r = await fetch(
    `${url}/rest/v1/history_days?select=md,data,story,updated_at&md=eq.${md}`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 900, tags: [`history:${md}`] },
      signal: AbortSignal.timeout(8000),
    },
  ).catch(() => null);
  if (!r?.ok) return null;
  return ((await r.json()) as HistoryDay[])[0] ?? null;
}

/**
 * Builds a date from NOAA's records and stores it; writes its stories when `story` is set
 * (or keeps the stored ones). A stored date is rebuilt after 300 days, so each new year's
 * tornadoes and storms join it.
 */
export async function ensureDay(md: string, story = true) {
  const db = supabaseAdmin();
  const { data: have } = await db
    .from("history_days")
    .select("md, story, updated_at")
    .eq("md", md)
    .maybeSingle();
  const fresh =
    have && Date.now() - Date.parse(have.updated_at) < 300 * 86400_000;
  if (fresh && (have.story || !story)) return { md, built: false };
  const data = fresh
    ? ((await db.from("history_days").select("data").eq("md", md).single()).data
        ?.data as OtdData)
    : await buildDay(md);
  const s = story ? await writeStory(data) : null;
  const { error } = await db.from("history_days").upsert({
    md,
    data,
    story: s ?? have?.story ?? null,
    updated_at: fresh ? have.updated_at : new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return { md, built: !fresh, story: Boolean(s) };
}
