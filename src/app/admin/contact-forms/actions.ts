"use server";

import { updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { cleanForms } from "@/lib/help/forms";

export type SaveState = { error?: string; saved?: boolean };

export async function saveContactForms(json: string): Promise<SaveState> {
  const { supabase } = await requireAdmin("contact-forms");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { error: "The forms couldn't be read. Reload and try again." };
  }
  const forms = cleanForms(raw);
  const { data, error } = await supabase
    .from("app_config")
    .update({ value: forms, updated_at: new Date().toISOString() })
    .eq("key", "contact_forms")
    .select("key");
  if (error || !data?.length) return { error: "Couldn't save. Try again." };
  await supabase.rpc("log_admin", {
    p_action: "edit_contact_forms",
    p_target: "contact forms",
    p_detail: { forms: forms.tabs.map((t) => t.id) },
  });
  updateTag("contact-forms");
  return { saved: true };
}
