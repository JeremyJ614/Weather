import "server-only";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getRealViewer } from "./viewer";

/**
 * Admin rights are tied to the account itself (owner's call, Fix-It #4): any signed-in
 * session of an admin opens the panel. Non-admins get a plain 404, so the panel's
 * existence isn't revealed.
 */
export async function requireAdmin(section?: string) {
  const viewer = await getRealViewer();
  if (!viewer.isAdmin) notFound();
  const supabase = await supabaseServer();
  if (section) {
    const { data: ok } = await supabase.rpc("can_admin", { s: section });
    if (!ok) notFound();
  }
  return { viewer, supabase, isFounder: viewer.roles.includes("founder") };
}
