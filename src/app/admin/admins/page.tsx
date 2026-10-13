import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ADMIN_SECTIONS } from "@/lib/admin/sections";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { grantAdmin, removeAdmin, setSections } from "../actions";

export const metadata: Metadata = {
  title: "Admins & access · StormSync Media",
};

type P = {
  id: string;
  first_name: string;
  last_name: string;
  city: string;
  state: string;
  referral_code: number;
};
const name = (p: P) => `${p.first_name} ${p.last_name}`;
const grantable = ADMIN_SECTIONS.filter((s) => !s.founderOnly);

export default async function Admins({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { supabase, isFounder } = await requireAdmin();
  if (!isFounder) notFound();
  const q = ((await searchParams).q ?? "").trim().slice(0, 40);

  const [{ data: roles }, { data: perms }] = await Promise.all([
    supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "founder"]),
    supabase.from("admin_permissions").select("user_id, section"),
  ]);
  const adminIds = (roles ?? [])
    .filter((r) => r.role === "admin")
    .map((r) => r.user_id);
  const cols = "id, first_name, last_name, city, state, referral_code";
  const [{ data: admins }, { data: found }] = await Promise.all([
    adminIds.length
      ? supabase.from("profiles").select(cols).in("id", adminIds)
      : Promise.resolve({ data: [] as P[] }),
    q
      ? supabase
          .from("profiles")
          .select(cols)
          .or(
            /^\d{6}$/.test(q)
              ? `referral_code.eq.${q}`
              : `first_name.ilike.%${q.replace(/[%,()]/g, "")}%,last_name.ilike.%${q.replace(/[%,()]/g, "")}%`,
          )
          .limit(20)
      : Promise.resolve({ data: [] as P[] }),
  ]);
  const staff = new Set((roles ?? []).map((r) => r.user_id));

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 pt-6 pb-24">
      <h1 className="display text-3xl text-accent">Admins &amp; access</h1>

      <section className="grid gap-3">
        <h2 className="font-bold">Admins</h2>
        {!admins?.length && (
          <p className="text-sm text-muted">
            No admins yet. Find a member below.
          </p>
        )}
        {(admins as P[] | null)?.map((a) => {
          const mine = new Set(
            (perms ?? [])
              .filter((x) => x.user_id === a.id)
              .map((x) => x.section),
          );
          return (
            <Card key={a.id} className="grid gap-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold">
                  {name(a)}{" "}
                  <span className="text-sm font-normal text-muted">
                    · {a.city}, {a.state}
                  </span>
                </p>
                <form action={removeAdmin}>
                  <input type="hidden" name="userId" value={a.id} />
                  <input type="hidden" name="name" value={name(a)} />
                  <Button type="submit" variant="ghost" className="text-accent">
                    Remove admin
                  </Button>
                </form>
              </div>
              <form action={setSections} className="grid gap-3">
                <input type="hidden" name="userId" value={a.id} />
                <input type="hidden" name="name" value={name(a)} />
                <fieldset className="flex flex-wrap gap-2">
                  <legend className="mb-2 text-sm text-muted">
                    Sections they can open
                  </legend>
                  {grantable.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:text-accent"
                    >
                      <input
                        type="checkbox"
                        name="section"
                        value={s.id}
                        defaultChecked={mine.has(s.id)}
                        className="accent-[var(--accent)]"
                      />
                      {s.label}
                    </label>
                  ))}
                </fieldset>
                <Button type="submit" className="justify-self-start">
                  Save sections
                </Button>
              </form>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-3">
        <h2 className="font-bold">Make a member an admin</h2>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Name or 6-digit referral code"
            aria-label="Find a member"
            className="min-h-11 flex-1 rounded-xl border border-line bg-bg px-3"
          />
          <Button type="submit">Find</Button>
        </form>
        {q && !found?.length && (
          <p className="text-sm text-muted">No members match “{q}”.</p>
        )}
        {(found as P[] | null)?.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2"
          >
            <span>
              {name(m)}{" "}
              <span className="text-sm text-muted">
                · {m.city}, {m.state} · #{m.referral_code}
              </span>
            </span>
            {staff.has(m.id) ? (
              <span className="text-sm text-muted">Already staff</span>
            ) : (
              <form action={grantAdmin}>
                <input type="hidden" name="userId" value={m.id} />
                <input type="hidden" name="name" value={name(m)} />
                <Button type="submit" variant="primary">
                  Make admin
                </Button>
              </form>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
