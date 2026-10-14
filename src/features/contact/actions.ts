"use server";

import { supabaseServer } from "@/lib/supabase/server";

export type ContactState = { error?: string; sent?: boolean } | null;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Every form that writes to the team goes through here into admin → Contact inbox. */
export async function sendContact(
  _: ContactState,
  fd: FormData,
): Promise<ContactState> {
  const s = (k: string, n: number) =>
    String(fd.get(k) ?? "")
      .trim()
      .slice(0, n);
  const form = s("form", 32).toLowerCase();
  const name = s("name", 80);
  const email = s("email", 200);
  const body = s("body", 4000);
  if (!/^[a-z0-9-]{1,32}$/.test(form))
    return { error: "That form couldn't be read." };
  if (!name) return { error: "Enter your name." };
  if (!EMAIL.test(email)) return { error: "Enter your email so we can reply." };
  if (!body) return { error: "Write your message." };
  // Bots fill every field, including the hidden one.
  if (s("website", 200)) return { sent: true };
  const sb = await supabaseServer();
  const { error } = await sb.rpc("contact_send", {
    p_form: form,
    p_name: name,
    p_email: email,
    p_subject: s("subject", 120),
    p_body: body,
  });
  if (error)
    return {
      error:
        error.code === "54000"
          ? "That's a lot of messages. Try again in an hour."
          : "Your message couldn't be sent. Try again.",
    };
  return { sent: true };
}
