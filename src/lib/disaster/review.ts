import "server-only";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE } from "@/lib/billing/invoice";
import type { Status } from "./data";

const FROM = "StormSync Media <no-reply@send.sswx.space>";
const ID = /^[0-9a-f-]{36}$/;

/** Tells whoever signed up that they were approved. Never throws: the decision is saved. */
async function tellApproved(
  kind: "org" | "volunteer",
  to: { name: string; email: string },
  what: string,
) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const text =
    kind === "org"
      ? [
          `Hi ${to.name},`,
          "",
          `${what} is now listed on StormSync Disaster Response, where members and visitors can find you, donate and volunteer:`,
          `${SITE}/disaster-response`,
          "",
          "To change your listing, reply to this email.",
          "",
          "Thank you for the work you do.",
          "StormSync Media",
        ]
      : [
          `Hi ${to.name},`,
          "",
          "You're on the StormSync Disaster Response volunteer roster. When a storm hits near you, we'll be in touch by email with organizations that need help.",
          "",
          "To change your details or leave the roster, reply to this email.",
          "",
          "Thank you for stepping up.",
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
      subject:
        kind === "org"
          ? `${what} is listed on StormSync Disaster Response`.slice(0, 150)
          : "You're on the StormSync volunteer roster",
      text: text.join("\n"),
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => {});
}

/**
 * Approves, declines or unlists a sign-up (from admin → Contact inbox or admin → Disaster
 * Response). The first approval of a sign-up emails the person who sent it.
 */
export async function reviewSignup(
  supabase: SupabaseClient,
  kind: "org" | "volunteer",
  id: string,
  status: Status,
): Promise<{ error?: string }> {
  if (!ID.test(id) || !["pending", "approved", "declined"].includes(status))
    return { error: "That sign-up couldn't be found." };
  const table = kind === "org" ? "disaster_orgs" : "disaster_volunteers";
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
    p_action: `${status === "approved" ? "approve" : status === "declined" ? "decline" : "unlist"}_disaster_${kind}`,
    p_target: id,
    p_detail: { name: before.name },
  });
  if (status === "approved" && !before.reviewed_at && before.message_id) {
    const { data: m } = await supabase
      .from("contact_messages")
      .select("name, email")
      .eq("id", before.message_id)
      .maybeSingle();
    if (m) await tellApproved(kind, m, before.name);
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
