"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";

const ok = (id: string) => /^[0-9a-f-]{36}$/.test(id);

export async function markMessage(id: string, read: boolean) {
  const { supabase } = await requireAdmin("inbox");
  if (!ok(id)) return { error: "That message couldn't be found." };
  const { error } = await supabase
    .from("contact_messages")
    .update({ read })
    .eq("id", id);
  if (error) return { error: "Couldn't save. Try again." };
  revalidatePath("/admin/inbox");
  return {};
}

export async function deleteMessage(id: string) {
  const { supabase } = await requireAdmin("inbox");
  if (!ok(id)) return { error: "That message couldn't be found." };
  const { error } = await supabase
    .from("contact_messages")
    .delete()
    .eq("id", id);
  if (error) return { error: "Couldn't delete. Try again." };
  await supabase.rpc("log_admin", {
    p_action: "delete_message",
    p_target: id,
    p_detail: {},
  });
  revalidatePath("/admin/inbox");
  return {};
}
