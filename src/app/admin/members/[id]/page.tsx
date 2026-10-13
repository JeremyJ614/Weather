import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { age } from "@/lib/auth/signup";
import { setMember, startLens } from "../../actions";

export const metadata: Metadata = { title: "Member · Admin · StormSync Media" };

/** Read-only lookup of one member: what they see, for answering questions. */
export default async function Member({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, isFounder } = await requireAdmin("members");
  const [
    { data: p },
    { data: roles },
    { data: referred },
    { data: pts },
    { data: canView },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", id),
    supabase
      .from("profiles")
      .select("first_name, last_name, created_at")
      .eq("referred_by", id)
      .order("created_at", { ascending: false }),
    supabase.from("game_points").select("source, points").eq("user_id", id),
    isFounder
      ? supabase.rpc("lens_target_ok", { p_user: id })
      : Promise.resolve({ data: false }),
  ]);
  const total = (src?: string) =>
    (pts ?? [])
      .filter((x) => !src || x.source === src)
      .reduce((a, x) => a + x.points, 0);
  if (!p) notFound();
  const { data: referrer } = p.referred_by
    ? await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", p.referred_by)
        .maybeSingle()
    : { data: null };
  const r = (roles ?? []).map((x) => x.role);
  const isMember = r.includes("member");
  const name = `${p.first_name} ${p.last_name}`;
  const rows: [string, string][] = [
    [
      "Display name",
      p.use_nickname && p.nickname
        ? p.nickname
        : `${p.first_name} ${p.last_name.slice(0, 1)}.`,
    ],
    ["Nickname", p.nickname ?? "–"],
    ["Location", `${p.city}, ${p.state}`],
    ["Phone", p.phone ?? "–"],
    ["Age", String(age(p.birthday))],
    ["Plan", p.tier],
    ["Roles", r.length ? r.join(", ") : "none"],
    ["Referral code", `#${p.referral_code}`],
    [
      "Referred by",
      referrer ? `${referrer.first_name} ${referrer.last_name}` : "–",
    ],
    ["Found us", p.found_us ?? "–"],
    ["PIN set", p.pin_set ? "Yes" : "No"],
    [
      "Joined",
      new Date(p.created_at).toLocaleString("en-US", {
        timeZone: "America/Chicago",
      }),
    ],
  ];
  return (
    <main className="mx-auto grid max-w-md gap-4 px-4 pt-6 pb-24">
      <h1 className="display text-3xl text-accent">{name}</h1>
      {created && (
        <p
          role="status"
          className="rounded-xl border border-[var(--lit-line)] bg-[var(--lit)] p-3 text-sm"
        >
          Account created.{" "}
          {created === "link"
            ? "A sign-in link is on its way to their email."
            : "They can sign in with their email and the PIN you set."}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Points", total()],
          ["Forecast", total("forecast_game")],
          ["Trivia", total("trivia")],
        ].map(([k, v]) => (
          <div
            key={k}
            className="grid gap-0.5 rounded-2xl border border-line bg-surface p-3 text-center"
          >
            <b className="mono text-xl text-accent">
              {Number(v).toLocaleString("en-US")}
            </b>
            <span className="text-xs text-muted">{k}</span>
          </div>
        ))}
      </div>
      {canView && (
        <form
          action={startLens}
          className="grid gap-1 rounded-2xl border border-[var(--lit-line)] bg-[var(--lit)] p-4"
        >
          <input type="hidden" name="userId" value={id} />
          <b>View the app as {p.first_name}</b>
          <span className="text-sm text-muted">
            See every page as they do and play today&apos;s Forecast Game and
            Trivia for them. Your own sign-in stays; a bar at the top brings you
            back in one tap. Everything played is logged under your name.
          </span>
          <Button type="submit" variant="primary" className="mt-2">
            View as {p.first_name}
          </Button>
        </form>
      )}
      <Card>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <form action={setMember}>
        <input type="hidden" name="userId" value={id} />
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="on" value={isMember ? "0" : "1"} />
        <Button
          type="submit"
          variant={isMember ? "ghost" : "primary"}
          className="w-full"
        >
          {isMember ? "Remove SSWX Member" : "Make SSWX Member"}
        </Button>
      </form>
      <section className="grid gap-2">
        <h2 className="font-bold">Referred {referred?.length ?? 0}</h2>
        {(referred ?? []).map((x, i) => (
          <p key={i} className="text-sm text-muted">
            {x.first_name} {x.last_name.slice(0, 1)}. ·{" "}
            {new Date(x.created_at).toLocaleDateString("en-US")}
          </p>
        ))}
      </section>
    </main>
  );
}
