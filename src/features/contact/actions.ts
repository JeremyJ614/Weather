"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { checkSubmission, getContactForms } from "@/lib/help/forms";
import { alertInbox } from "@/lib/help/alert";

export type ContactState = { error?: string; sent?: boolean } | null;

/**
 * Every Contact Us form goes through here: checked against the form the owner built, then
 * saved to admin → Contact inbox (tagged with the form's id) and the team is alerted.
 */
export async function sendContact(
  _: ContactState,
  fd: FormData,
): Promise<ContactState> {
  const form = String(fd.get("form") ?? "");
  const tab = (await getContactForms()).tabs.find((t) => t.on && t.id === form);
  if (!tab) return { error: "That form couldn't be read. Reload the page." };
  // Bots fill every field, including the hidden one.
  if (String(fd.get("website") ?? "")) return { sent: true };
  const m = checkSubmission(tab, (id) => String(fd.get(`f_${id}`) ?? ""));
  if ("error" in m) return m;
  const sb = await supabaseServer();
  const { error } = await sb.rpc("contact_send", {
    p_form: tab.id,
    p_name: m.name,
    p_email: m.email,
    p_subject: m.subject,
    p_body: m.body,
  });
  if (error)
    return {
      error:
        error.code === "54000"
          ? "That's a lot of messages. Try again in an hour."
          : "Your message couldn't be sent. Try again.",
    };
  await alertInbox({ form: tab.title, ...m });
  return { sent: true };
}
