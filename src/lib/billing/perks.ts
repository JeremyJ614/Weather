import "server-only";
import { readJson, writeJson } from "@/lib/ops/store";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * State for the post-launch A4 offers, kept as small JSON files in the private `ops` bucket
 * (no new tables while the database's SQL is out of reach): Founding Members, trials used,
 * Day Passes and spotter / first-responder requests.
 */
type Founders = { ids: string[] };
type Trials = { ids: string[] };
export type Pass = {
  until: number;
  session: string;
  credit: number;
  used?: boolean;
};
export type Responder = {
  user: string;
  name: string;
  email: string;
  role: string;
  agency: string;
  photo: string | null;
  at: string;
  status: "pending" | "approved" | "declined";
};

export const getFounders = () =>
  readJson<Founders>("perks/founders.json", { ids: [] });
export const getTrials = () =>
  readJson<Trials>("perks/trials.json", { ids: [] });
export const getPass = (user: string) =>
  readJson<Pass | null>(`perks/passes/${user}.json`, null);
export const savePass = (user: string, p: Pass) =>
  writeJson(`perks/passes/${user}.json`, p);
export const getResponders = () =>
  readJson<{ list: Responder[] }>("perks/responders.json", { list: [] });
export const saveResponders = (list: Responder[]) =>
  writeJson("perks/responders.json", { list });

export async function isResponder(user: string) {
  return (await getResponders()).list.some(
    (r) => r.user === user && r.status === "approved",
  );
}

export async function markTrial(user: string) {
  const t = await getTrials();
  if (!t.ids.includes(user))
    await writeJson("perks/trials.json", { ids: [...t.ids, user] });
}

/** The gold Founder badge (made once, rarity Legendary); returns its id. */
async function founderBadge() {
  const db = supabaseAdmin();
  const { data } = await db
    .from("badges")
    .select("id")
    .eq("name", "Founder")
    .maybeSingle();
  if (data?.id) return data.id as string;
  const { data: made } = await db
    .from("badges")
    .insert({
      name: "Founder",
      description: "One of the first 100 paid members of StormSync Weather.",
      icon: "Crown",
      rarity: "legendary",
      grp: "Membership",
    })
    .select("id")
    .single();
  return (made?.id as string | undefined) ?? null;
}

/**
 * A paid plan just started: while Founding Member spots are left, this member takes one,
 * gets the Founder badge and a notice. Returns true when they became a Founder.
 */
export async function claimFounder(user: string, spots: number) {
  const f = await getFounders();
  if (f.ids.includes(user) || f.ids.length >= spots) return false;
  await writeJson("perks/founders.json", { ids: [...f.ids, user] });
  const db = supabaseAdmin();
  const badge = await founderBadge().catch(() => null);
  if (badge)
    await db.from("member_badges").upsert({ user_id: user, badge_id: badge });
  await db.from("notifications").insert({
    user_id: user,
    level: "info",
    title: `You're Founding Member #${f.ids.length + 1}`,
    body: "Your price is locked for as long as you stay, and the gold Founder badge is on your profile.",
  });
  return true;
}
