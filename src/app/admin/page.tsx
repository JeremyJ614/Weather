import type { Metadata } from "next";
import { ADMIN_GROUPS, ADMIN_SECTIONS } from "@/lib/admin/sections";
import { AdminIndex } from "./AdminIndex";
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
    isFounder ? true : !s.founderOnly && allowed.has(s.perm ?? s.id),
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <main className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-6 px-4 pt-6 pb-24">
      <div>
        <h1 className="display text-4xl text-accent">Admin</h1>
        <p className="mt-1 text-sm text-muted">
          {viewer.name ?? "Admin"} ·{" "}
          {isFounder ? "SSWX Founder" : "SSWX Administration"}
        </p>
      </div>
      <AdminIndex
        groups={ADMIN_GROUPS}
        sections={visible}
        shortcuts={
          isFounder ? user?.user_metadata?.admin_shortcuts === true : null
        }
      />
    </main>
  );
}
