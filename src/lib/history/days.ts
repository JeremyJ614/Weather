import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildDay, type OtdData, type OtdFeature } from "./onthisday";
import { writeFeature, type OtdStory } from "./story";
import { articlePhotos, findArticle } from "./wiki";

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
 * Chooses the day's featured event and writes it up. NOAA's strongest few candidates are
 * looked up on Wikipedia: the strongest one with an article about it (naming the U.S. place)
 * wins, as long as NOAA rates it at least 60% as significant as the strongest overall.
 */
export async function featureStory(
  d: OtdData,
  write: boolean,
): Promise<{ feature: OtdFeature | null; story: OtdStory | null }> {
  const cands = d.candidates ?? (d.feature ? [d.feature] : []);
  if (!cands.length) return { feature: null, story: null };
  // One at a time, strongest first, so Wikipedia sees as few requests as possible. When it
  // doesn't answer (rate limits), the story is marked to be written again on the next run.
  let i = 0;
  let article = null;
  let unsure = false;
  for (let k = 0; k < cands.length && !article && !unsure; k++) {
    if (cands[k].score < 0.6 * cands[0].score) break;
    article = await findArticle(cands[k], d.md).catch(() => {
      unsure = true;
      return null;
    });
    if (article) i = k;
  }
  const feature = cands[i];
  if (!write) return { feature, story: null };
  const [text, photos] = await Promise.all([
    writeFeature(feature, d.md, article),
    article
      ? articlePhotos(article.title).catch(() => {
          unsure = true;
          return [];
        })
      : [],
  ]);
  return {
    feature,
    story: text
      ? {
          ...text,
          photos,
          source: article ? { title: article.title, url: article.url } : null,
          written: new Date().toISOString(),
          ...(unsure ? { retry: true } : {}),
        }
      : null,
  };
}

/**
 * Builds a date from NOAA's records and stores it with its featured event's story (or keeps
 * the stored one). A stored date is rebuilt after 300 days, so each new year's events join.
 */
const busy = new Map<string, Promise<unknown>>();

/** One build per date at a time on this server, however many visits ask. */
export function ensureDay(md: string, story = true) {
  const run =
    busy.get(md) ?? buildAndStore(md, story).finally(() => busy.delete(md));
  busy.set(md, run);
  return run;
}

async function buildAndStore(md: string, story: boolean) {
  const db = supabaseAdmin();
  const { data: have } = await db
    .from("history_days")
    .select("md, story, updated_at")
    .eq("md", md)
    .maybeSingle();
  const fresh =
    have && Date.now() - Date.parse(have.updated_at) < 300 * 86400_000;
  // Stories from before the featured-event redesign (no "title") are written again, and so
  // is one written while Wikipedia wasn't answering, half an hour later.
  const st = have?.story as Partial<OtdStory> | null;
  const current = Boolean(
    st?.title &&
    (!st.retry || Date.now() - Date.parse(st.written ?? "") < 30 * 60_000),
  );
  if (fresh && (current || !story)) return { md, built: false };
  let data = fresh
    ? ((await db.from("history_days").select("data").eq("md", md).single()).data
        ?.data as OtdData)
    : await buildDay(md);
  // Dates stored before the redesign have no candidates yet.
  const old = fresh && data && data.candidates === undefined;
  if (old) data = await buildDay(md);
  const { feature, story: s } = await featureStory(data, story);
  if (s || !current) data = { ...data, feature };
  const { error } = await db.from("history_days").upsert({
    md,
    data,
    story: s ?? (current ? have!.story : null),
    updated_at:
      fresh && !old && have ? have.updated_at : new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return { md, built: !fresh, story: Boolean(s) };
}
