import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { cleanInvoice } from "@/lib/billing/invoice";
import { InvoiceEditor } from "./InvoiceEditor";
import { sampleLines } from "./actions";

export const metadata: Metadata = {
  title: "Invoice email · Admin · StormSync Media",
};

/** The receipt members get after a payment (VIP #22). Real sends start with checkout. */
export default async function Invoices() {
  const { supabase, viewer } = await requireAdmin("billing");
  const [{ data }, lines] = await Promise.all([
    supabase
      .from("app_config")
      .select("value")
      .eq("key", "invoice_template")
      .maybeSingle(),
    sampleLines(),
  ]);
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 pt-6 pb-24">
      <div>
        <h1 className="display text-3xl text-accent">Invoice email</h1>
        <p className="mt-1 text-sm text-muted">
          The receipt members get after each payment. Members get it once card
          payments open (Phase 64); until then, send yourself a test.
        </p>
      </div>
      <InvoiceEditor
        initial={cleanInvoice(data?.value)}
        lines={lines}
        name={viewer.name ?? "Member"}
      />
    </main>
  );
}
