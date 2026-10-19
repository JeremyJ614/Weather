"use server";

import { updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { cleanFaq } from "@/lib/help/faq";

export type SaveState = { error?: string; saved?: boolean };

export async function saveFaq(json: string): Promise<SaveState> {
  const { supabase } = await requireAdmin("faq");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { error: "The FAQ couldn't be read. Reload and try again." };
  }
  const faq = cleanFaq(raw);
  const { data, error } = await supabase
    .from("app_config")
    .update({ value: faq, updated_at: new Date().toISOString() })
    .eq("key", "faq")
    .select("key");
  if (error || !data?.length) return { error: "Couldn't save. Try again." };
  await supabase.rpc("log_admin", {
    p_action: "edit_faq",
    p_target: "faq",
    p_detail: {
      tabs: faq.tabs.length,
      questions: faq.tabs.reduce(
        (n, t) => n + t.sections.reduce((m, s) => m + s.items.length, 0),
        0,
      ),
    },
  });
  updateTag("faq");
  return { saved: true };
}
