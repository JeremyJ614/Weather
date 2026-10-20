"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { alertInbox } from "@/lib/help/alert";
import {
  checkContact,
  checkOrg,
  checkVolunteer,
  orgMessage,
  volunteerMessage,
} from "@/lib/disaster/data";

export type SignupState = { error?: string; sent?: boolean } | null;

const reader = (fd: FormData) => ({
  get: (k: string) => String(fd.get(k) ?? ""),
  all: (k: string) => fd.getAll(k).map(String),
});

async function send(
  kind: "org" | "volunteer",
  who: { name: string; email: string },
  m: { subject: string; body: string },
  data: Record<string, unknown>,
): Promise<SignupState> {
  const sb = await supabaseServer();
  const { error } = await sb.rpc("disaster_apply", {
    p_kind: kind,
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
    form:
      kind === "org"
        ? "Disaster Response: organization"
        : "Disaster Response: volunteer",
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
  return send("org", who, orgMessage(org), org);
}

/** A volunteer signs up; approval adds them to the roster in admin → Disaster Response. */
export async function applyVolunteer(
  _: SignupState,
  fd: FormData,
): Promise<SignupState> {
  if (String(fd.get("website_confirm") ?? "")) return { sent: true };
  const { get, all } = reader(fd);
  const who = checkContact(get);
  if ("error" in who) return who;
  const v = checkVolunteer(get, all);
  if ("error" in v) return v;
  let org: string | null = null;
  if (v.org_id) {
    const { data } = await (
      await supabaseServer()
    )
      .from("disaster_orgs")
      .select("name")
      .eq("id", v.org_id)
      .eq("status", "approved")
      .maybeSingle();
    org = data?.name ?? null;
    if (!org) v.org_id = null;
  }
  return send("volunteer", who, volunteerMessage(who.name, v, org), v);
}
