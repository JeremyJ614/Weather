"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { alertInbox } from "@/lib/help/alert";
import { checkContact, checkOrg, orgMessage } from "@/lib/disaster/data";

export type SignupState = { error?: string; sent?: boolean } | null;

const reader = (fd: FormData) => ({
  get: (k: string) => String(fd.get(k) ?? ""),
  all: (k: string) => fd.getAll(k).map(String),
});

async function send(
  who: { name: string; email: string },
  m: { subject: string; body: string },
  data: Record<string, unknown>,
): Promise<SignupState> {
  const sb = await supabaseServer();
  const { error } = await sb.rpc("disaster_apply", {
    p_kind: "org",
    p_name: who.name,
    p_email: who.email,
    p_subject: m.subject,
    p_body: m.body,
    p_data: data,
  });
  if (error)
    return {
      error:
        error.code === "54000"
          ? "That's a lot of sign-ups. Try again in an hour."
          : "Your sign-up couldn't be sent. Try again.",
    };
  await alertInbox({
    form: "Disaster Response: organization",
    ...who,
    ...m,
  });
  return { sent: true };
}

/** An organization asks to be listed; it shows once an admin approves it in the inbox. */
export async function applyOrg(
  _: SignupState,
  fd: FormData,
): Promise<SignupState> {
  // Bots fill every field, including the hidden one.
  if (String(fd.get("website_confirm") ?? "")) return { sent: true };
  const { get, all } = reader(fd);
  const who = checkContact(get);
  if ("error" in who) return who;
  const org = checkOrg(get, all);
  if ("error" in org) return org;
  return send(who, orgMessage(org), org);
}
