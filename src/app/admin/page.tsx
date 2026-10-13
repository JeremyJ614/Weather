import type { Metadata } from "next";
import Link from "next/link";
import { NavIcon } from "@/components/NavIcon";
import { ADMIN_SECTIONS } from "@/lib/admin/sections";
import { requireAdmin } from "@/lib/auth/admin-guard";

export const metadata: Metadata = { title: "Admin · StormSync Media" };

export default async function Admin() {
  const { supabase, isFounder, viewer } = await requireAdmin();
  const { data: perms } = isFounder
    ? { data: null }
    : await supabase.from("admin_permissions").select("section");
  const allowed = new Set((perms ?? []).map((p) => p.section));
  allowed.add("audit");
  const visible = ADMIN_SECTIONS.filter((s) =>
    isFounder ? true : !s.founderOnly && allowed.has(s.id),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-24">
      <h1 className="display text-4xl text-accent">Admin</h1>
      <p className="mt-1 text-sm text-muted">
        {viewer.name ?? "Admin"} ·{" "}
        {isFounder ? "SSWX Founder" : "SSWX Administration"}
      </p>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map((s) => {
          const body = (
            <>
              <NavIcon name={s.icon} className="size-6 text-accent" />
              <span className="font-bold">{s.label}</span>
              {!s.href && (
                <span className="text-xs text-muted">
                  Built in phase {s.phase}
                </span>
              )}
            </>
          );
          const cls =
            "grid min-h-28 content-start gap-2 rounded-2xl border p-4 transition-transform active:scale-[.97]";
          return (
            <li key={s.id}>
              {s.href ? (
                <Link href={s.href} className={`${cls} border-line bg-surface`}>
                  {body}
                </Link>
              ) : (
                <div
                  className={`${cls} border-dashed border-line bg-bg opacity-70`}
                  aria-disabled
                >
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
