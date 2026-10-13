import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { requireAdmin } from "@/lib/auth/admin-guard";

export const metadata: Metadata = {
  title: "Members · Admin · StormSync Media",
};

const COLS =
  "id, first_name, last_name, city, state, referral_code, created_at";

export default async function Members({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { supabase } = await requireAdmin("members");
  const q = ((await searchParams).q ?? "")
    .trim()
    .slice(0, 40)
    .replace(/[%,()]/g, "");
  let query = supabase
    .from("profiles")
    .select(COLS, { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(50);
  if (q)
    query = /^\d{6}$/.test(q)
      ? query.eq("referral_code", Number(q))
      : query.or(
          `first_name.ilike.%${q}%,last_name.ilike.%${q}%,city.ilike.%${q}%`,
        );
  const [{ data: people, count }, { data: refs }, { data: roles }] =
    await Promise.all([
      query,
      supabase.rpc("referral_counts"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
  const refCount = new Map<string, number>(
    ((refs ?? []) as { referrer: string; referrals: number }[]).map((r) => [
      r.referrer,
      Number(r.referrals),
    ]),
  );
  const roleOf = new Map<string, string[]>();
  (roles ?? []).forEach((r) =>
    roleOf.set(r.user_id, [...(roleOf.get(r.user_id) ?? []), r.role]),
  );

  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 pt-6 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="display text-3xl text-accent">Members</h1>
          <p className="mt-1 text-sm text-muted">
            {count ?? 0} {q ? "matching" : "accounts"}
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a file download, not a page */}
        <a
          download
          href="/api/admin/export?what=members"
          className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-bold text-accent"
        >
          Download CSV
        </a>
      </div>
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Name, city or referral code"
          aria-label="Search members"
          className="min-h-11 flex-1 rounded-xl border border-line bg-bg px-3"
        />
        <Button type="submit">Search</Button>
      </form>
      <ul className="grid gap-2">
        {(people ?? []).map((p) => (
          <li key={p.id}>
            <Link
              href={`/admin/members/${p.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2"
            >
              <span>
                <span className="font-bold">
                  {p.first_name} {p.last_name}
                </span>
                <span className="block text-xs text-muted">
                  {p.city}, {p.state} · #{p.referral_code} · joined{" "}
                  {new Date(p.created_at).toLocaleDateString("en-US")}
                </span>
              </span>
              <span className="text-right text-xs text-muted">
                {(roleOf.get(p.id) ?? []).map((r) => (
                  <span key={r} className="mr-1 text-accent">
                    {r === "member"
                      ? "SSWX Member"
                      : r === "admin"
                        ? "Admin"
                        : "Founder"}
                  </span>
                ))}
                <span className="block">
                  {refCount.get(p.id) ?? 0} referred
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
