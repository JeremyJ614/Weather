import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { age } from "@/lib/auth/signup";
import { setMember } from "../../actions";

export const metadata: Metadata = { title: "Member · Admin · StormSync Media" };

/** Read-only lookup of one member: what they see, for answering questions. */
export default async function Member({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase } = await requireAdmin("members");
  const [{ data: p }, { data: roles }, { data: referred }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", id),
    supabase
      .from("profiles")
      .select("first_name, last_name, created_at")
      .eq("referred_by", id)
      .order("created_at", { ascending: false }),
  ]);
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
