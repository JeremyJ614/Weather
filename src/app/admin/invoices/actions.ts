"use server";

import { updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getBilling } from "@/lib/billing/server";
import {
  cleanInvoice,
  invoiceHtml,
  type InvoiceLine,
} from "@/lib/billing/invoice";

export type InvoiceState = { error?: string; ok?: string } | null;

/** A sample receipt from today's real prices (VIP monthly, one add-on, a code). */
export async function sampleLines(): Promise<InvoiceLine[]> {
  const b = await getBilling();
  const vip = b.tiers.find((t) => t.id === "vip") ?? b.tiers.at(-1)!;
  return [
    { label: `${vip.name} · monthly`, cents: vip.month },
    { label: "Sample code (10% off)", cents: -Math.round(vip.month / 10) },
  ];
}

export async function saveInvoice(json: string): Promise<InvoiceState> {
  const { supabase } = await requireAdmin("billing");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { error: "The template couldn't be read." };
  }
  const value = cleanInvoice(raw);
  const { data, error } = await supabase
    .from("app_config")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", "invoice_template")
    .select("key");
  if (error || !data?.length) return { error: "Couldn't save. Try again." };
  await supabase.rpc("log_admin", {
    p_action: "edit_invoice_template",
    p_target: "invoice email",
    p_detail: {},
  });
  updateTag("invoice-template");
  return { ok: "Saved." };
}

/** Emails the (unsaved) template to the signed-in admin with sample lines. */
export async function sendTestInvoice(json: string): Promise<InvoiceState> {
  const { supabase, viewer } = await requireAdmin("billing");
  const key = process.env.RESEND_API_KEY;
  if (!key)
    return { error: "Email isn't set up on this server (RESEND_API_KEY)." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Your account has no email." };
  let raw: unknown = null;
  try {
    raw = JSON.parse(json);
  } catch {}
  const t = cleanInvoice(raw);
  const { subject, html } = invoiceHtml(t, {
    name: viewer.name ?? "there",
    plan: "VIP",
    number: "TEST",
    date: new Date().toLocaleDateString("en-US", { dateStyle: "long" }),
    lines: await sampleLines(),
  });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${t.fromName} <billing@send.sswx.space>`,
      to: user.email,
      subject: `[Test] ${subject}`,
      html,
    }),
  });
  if (!res.ok) return { error: "The test couldn't be sent. Try again." };
  return { ok: `Test sent to ${user.email}.` };
}
