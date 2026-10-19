import type { Metadata } from "next";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { getViewer } from "@/lib/auth/viewer";
import { getBilling } from "@/lib/billing/server";
import { getColors } from "@/lib/colors/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import type { Badge } from "@/lib/badges";
import { ProfileView, type ProfileData } from "./ProfileView";

export const metadata: Metadata = { title: "My Profile · StormSync Media" };
export const dynamic = "force-dynamic";

/** Days in a row (ending today or yesterday) with a forecast guess or a trivia answer. */
function streak(days: string[]) {
  const set = new Set(days);
  const d = new Date();
  const key = (x: Date) => x.toISOString().slice(0, 10);
  if (!set.has(key(d))) d.setUTCDate(d.getUTCDate() - 1);
  let n = 0;
  while (set.has(key(d))) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}
function best(days: string[]) {
  const sorted = [...new Set(days)].sort();
  let top = 0;
  let run = 0;
  let prev = 0;
  for (const s of sorted) {
    const t = Date.parse(`${s}T00:00:00Z`);
    run = prev && t - prev === 86400_000 ? run + 1 : 1;
    top = Math.max(top, run);
    prev = t;
  }
  return top;
}

/** My Profile: who you are here, what you've played and earned, and your places. */
export default async function Profile() {
  const viewer = await getViewer();
  if (!viewer.signedIn || !viewer.id)
    return (
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
        <PageHero
          icon={<UserRound aria-hidden />}
          eyebrow={["Account"]}
          title="My Profile"
          subtitle="Sign in to see your stats, badges and places."
        />
        <Link href="/login" className="text-accent underline">
          Log in or sign up
        </Link>
      </main>
    );
  const id = viewer.id;
  const db = await supabaseServer();
  // Anything earned since the last hourly award is given now, so it shows on this visit.
  const { data: fresh } = await db.rpc("award_my_badges");
  const [
    { data: p },
    { data: points },
    { data: trivia },
    { data: guesses },
    { data: votes },
    { data: mine },
    { data: badges },
    { data: progress },
    { data: titles },
    { data: sub },
    { data: bonus },
    billing,
    colors,
  ] = await Promise.all([
    db.from("profiles").select("*").eq("id", id).maybeSingle(),
    db
      .from("game_points")
      .select("source, points, earned_on")
      .eq("user_id", id),
    db.from("trivia_answers").select("correct").eq("user_id", id),
    db.from("game_guesses").select("guess_date").eq("user_id", id),
    db.from("poll_votes").select("poll_id").eq("user_id", id),
    db.from("member_badges").select("badge_id, awarded_at").eq("user_id", id),
    db
      .from("badges")
      .select(
        "id, name, description, icon, rarity, grp, rule_metric, rule_goal",
      ),
    db.rpc("my_badge_progress"),
    db
      .from("game_titles")
      .select("kind, period, name, points")
      .eq("user_id", id)
      .order("period", { ascending: false }),
    db
      .from("subscriptions")
      .select("tier, cycle, status")
      .eq("user_id", id)
      .maybeSingle(),
    db.from("referral_adjust").select("bonus").eq("user_id", id).maybeSingle(),
    getBilling(),
    getColors(),
  ]);
  // Who you brought in: other members' rows aren't readable under RLS, so count server-side.
  const { count: referred } = await supabaseAdmin()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", id);
  const pts = points ?? [];
  const sum = (src?: string) =>
    pts
      .filter((x) => !src || x.source === src)
      .reduce((a, x) => a + x.points, 0);
  const days = pts.map((x) => x.earned_on as string);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const owned = new Map(
    (mine ?? []).map((m) => [m.badge_id, m.awarded_at as string]),
  );
  const tierId = (sub?.tier as string) ?? "free";
  const data: ProfileData = {
    name: viewer.name ?? "Member",
    first: p?.first_name ?? "",
    last: p?.last_name ?? "",
    nickname: p?.nickname ?? "",
    useNickname: !!p?.use_nickname,
    city: p?.city ?? "",
    state: p?.state ?? "",
    phone: p?.phone ?? "",
    since: p?.created_at ?? null,
    code: p?.referral_code ?? null,
    referred: (referred ?? 0) + (bonus?.bonus ?? 0),
    roles: viewer.roles,
    tier:
      tierId === "custom"
        ? "Build your own"
        : (billing.tiers.find((t) => t.id === tierId)?.name ?? "Free"),
    cycle: (sub?.cycle as string) ?? null,
    points: {
      total: sum(),
      game: sum("forecast_game"),
      trivia: sum("trivia"),
      month: pts
        .filter((x) => String(x.earned_on).startsWith(thisMonth))
        .reduce((a, x) => a + x.points, 0),
    },
    guesses: guesses?.length ?? 0,
    trivia: {
      answered: trivia?.length ?? 0,
      correct: (trivia ?? []).filter((t) => t.correct).length,
    },
    votes: votes?.length ?? 0,
    streak: streak(days),
    bestStreak: best(days),
    badges: ((badges ?? []) as Badge[])
      .filter((b) => owned.has(b.id))
      .map((b) => ({ ...b, at: owned.get(b.id)! }))
      .sort((a, b) => b.at.localeCompare(a.at)),
    badgeTotal: badges?.length ?? 0,
    fresh: ((fresh ?? []) as string[]).filter((x) => typeof x === "string"),
    toEarn: ((badges ?? []) as Badge[])
      .filter((b) => b.rule_metric && b.rule_goal && !owned.has(b.id))
      .map((b) => ({
        ...b,
        value: Number(
          (progress ?? []).find(
            (m: { metric: string; value: number }) =>
              m.metric === b.rule_metric,
          )?.value ?? 0,
        ),
        goal: b.rule_goal!,
      }))
      // Closest to done first.
      .sort((a, b) => b.value / b.goal - a.value / a.goal),
    titles: (titles ?? []).map((t) => ({
      kind: t.kind as string,
      period: t.period as string,
      name: (t.name as string) ?? null,
      points: (t.points as number) ?? null,
    })),
  };
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <ProfileView data={data} colors={colors} />
    </main>
  );
}
