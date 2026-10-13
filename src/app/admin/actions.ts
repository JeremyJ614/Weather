"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { sectionIds } from "@/lib/admin/sections";

const UUID = /^[0-9a-f-]{36}$/;

async function founder() {
  const ctx = await requireAdmin();
  if (!ctx.isFounder)
    throw new Error("Only the Founder can change admin access");
  return ctx;
}

export async function grantAdmin(fd: FormData) {
  const { supabase, viewer } = await founder();
  const id = String(fd.get("userId") ?? "");
  const name = String(fd.get("name") ?? "");
  if (!UUID.test(id)) return;
  const { error } = await supabase
    .from("user_roles")
    .insert({ user_id: id, role: "admin" });
  if (!error)
    await supabase.rpc("log_admin", {
      p_action: "grant_admin",
      p_target: name,
      p_detail: { by: viewer.name },
    });
  revalidatePath("/admin/admins");
}

export async function removeAdmin(fd: FormData) {
  const { supabase } = await founder();
  const id = String(fd.get("userId") ?? "");
  const name = String(fd.get("name") ?? "");
  if (!UUID.test(id)) return;
  await supabase.from("admin_permissions").delete().eq("user_id", id);
  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", id)
    .eq("role", "admin");
  if (!error)
    await supabase.rpc("log_admin", {
      p_action: "remove_admin",
      p_target: name,
    });
  revalidatePath("/admin/admins");
}

export async function setSections(fd: FormData) {
  const { supabase } = await founder();
  const id = String(fd.get("userId") ?? "");
  const name = String(fd.get("name") ?? "");
  if (!UUID.test(id)) return;
  const want = fd
    .getAll("section")
    .map(String)
    .filter((s) => sectionIds.has(s) && s !== "admins");
  await supabase.from("admin_permissions").delete().eq("user_id", id);
  if (want.length) {
    await supabase
      .from("admin_permissions")
      .insert(want.map((section) => ({ user_id: id, section })));
  }
  await supabase.rpc("log_admin", {
    p_action: "set_sections",
    p_target: name,
    p_detail: { sections: want },
  });
  revalidatePath("/admin/admins");
}
