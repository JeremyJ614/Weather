import "server-only";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE } from "@/lib/billing/invoice";
import type { Status } from "./data";

const FROM = "StormSync Media <no-reply@send.sswx.space>";
const ID = /^[0-9a-f-]{36}$/;

/** Tells the organization that signed up that it is listed. Never throws: the decision is saved. */
async function tellApproved(to: { name: string; email: string }, what: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const text = [
    `Hi ${to.name},`,
    "",
    `${what} is now listed on StormSync Disaster Response, where members and visitors can find you, donate and volunteer:`,
    `${SITE}/disaster-response`,
    "",
    "To change your listing, reply to this email.",
    "",
    "Thank you for the work you do.",
    "StormSync Media",
  ];
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: to.email,
      subject: `${what} is listed on StormSync Disaster Response`.slice(0, 150),
      text: text.join("\n"),
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => {});
}

/**
 * Approves, declines or unlists an organization (from admin → Contact inbox or admin →
 * Disaster Response). The first approval emails the person who signed it up.
 */
export async function reviewSignup(
  supabase: SupabaseClient,
  id: string,
  status: Status,
): Promise<{ error?: string }> {
  if (!ID.test(id) || !["pending", "approved", "declined"].includes(status))
    return { error: "That sign-up couldn't be found." };
  const table = "disaster_orgs";
  const { data: before } = await supabase
    .from(table)
    .select("name, status, reviewed_at, message_id")
    .eq("id", id)
    .maybeSingle();
  if (!before) return { error: "That sign-up couldn't be found." };
  const { error } = await supabase
    .from(table)
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "Couldn't save. Try again." };
  await supabase.rpc("log_admin", {
    p_action: `${status === "approved" ? "approve" : status === "declined" ? "decline" : "unlist"}_disaster_org`,
    p_target: id,
    p_detail: { name: before.name },
  });
  if (status === "approved" && !before.reviewed_at && before.message_id) {
    const { data: m } = await supabase
      .from("contact_messages")
      .select("name, email")
      .eq("id", before.message_id)
      .maybeSingle();
    if (m) await tellApproved(m, before.name);
  }
  if (before.message_id)
    await supabase
      .from("contact_messages")
      .update({ read: true })
      .eq("id", before.message_id);
  revalidatePath("/disaster-response");
  revalidatePath("/admin/inbox");
  revalidatePath("/admin/disaster");
  return {};
}
