"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  invoiceHtml,
  type InvoiceLine,
  type InvoiceTemplate,
} from "@/lib/billing/invoice";
import { saveInvoice, sendTestInvoice, type InvoiceState } from "./actions";

const field = "min-h-11 w-full rounded-xl border border-line bg-bg px-3";

/** The invoice email with a live preview; save it or send yourself a test. */
export function InvoiceEditor({
  initial,
  lines,
  name,
}: {
  initial: InvoiceTemplate;
  lines: InvoiceLine[];
  name: string;
}) {
  const [t, setT] = useState(initial);
  const [msg, setMsg] = useState<InvoiceState>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof InvoiceTemplate, v: string) => (
    setT({ ...t, [k]: v }),
    setMsg(null)
  );
  const preview = invoiceHtml(t, {
    name,
    plan: "VIP",
    number: "PREVIEW",
    date: "Today",
    lines,
  });
  const area = (k: keyof InvoiceTemplate, label: string, n: number) => (
    <label className="grid gap-1 text-sm font-bold">
      {label}
      <textarea
        value={t[k]}
        maxLength={n}
        rows={2}
        onChange={(e) => set(k, e.target.value)}
        className="rounded-xl border border-line bg-bg px-3 py-2 font-normal"
      />
    </label>
  );
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-[1fr_4.5rem] gap-2">
        <label className="grid gap-1 text-sm font-bold">
          From name
          <input
            value={t.fromName}
            maxLength={60}
            onChange={(e) => set("fromName", e.target.value)}
            className={`${field} font-normal`}
          />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          Color
          <input
            type="color"
            value={t.accent}
            onChange={(e) => set("accent", e.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-bg"
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm font-bold">
        Subject
        <input
          value={t.subject}
          maxLength={120}
          onChange={(e) => set("subject", e.target.value)}
          className={`${field} font-normal`}
        />
      </label>
      {area("intro", "Opening", 600)}
      {area("footer", "Footer", 400)}
      <p className="text-xs text-muted">
        {"{name}"} and {"{plan}"} are filled in for each member.
      </p>
      <p className="text-sm">
        <span className="text-muted">Subject:</span> {preview.subject}
      </p>
      <iframe
        title="Invoice preview"
        srcDoc={preview.html}
        sandbox=""
        className="h-[440px] w-full rounded-2xl border border-line bg-[#0b0c14]"
      />
      {msg && (
        <p role="status" className="text-sm text-accent">
          {msg.error ?? msg.ok}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => setMsg(await sendTestInvoice(JSON.stringify(t))))
          }
        >
          Send a test to me
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={pending}
          onClick={() =>
            start(async () => setMsg(await saveInvoice(JSON.stringify(t))))
          }
        >
          {pending ? "Working…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
