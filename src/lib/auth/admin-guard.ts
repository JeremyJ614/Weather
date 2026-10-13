import "server-only";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getViewer } from "./viewer";

type Amr = { method: string } | string;

/**
 * A 4-digit PIN is a weak factor, so the admin panel needs a session that was opened with
 * Google or an email link. Non-admins get a plain 404: the panel's existence isn't revealed.
 */
export async function requireAdmin(section?: string) {
  const viewer = await getViewer();
  if (!viewer.isAdmin) notFound();
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const amr = (data?.claims.amr ?? []) as Amr[];
  const strong = amr.some(
    (a) => (typeof a === "string" ? a : a.method) !== "password",
  );
  if (!strong) redirect("/admin/verify");
  if (section) {
    const { data: ok } = await supabase.rpc("can_admin", { s: section });
    if (!ok) notFound();
  }
  return { viewer, supabase, isFounder: viewer.roles.includes("founder") };
}
