"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import type { ContactTab, FormField } from "@/lib/help/forms";
import { sendContact } from "./actions";

const field = "min-h-11 w-full rounded-xl border border-line bg-bg px-3";

function Input({ f, value }: { f: FormField; value?: string }) {
  const name = `f_${f.id}`;
  const common = {
    name,
    required: f.required,
    defaultValue: value,
    "aria-label": f.label,
  };
  if (f.kind === "long")
    return (
      <textarea
        {...common}
        maxLength={3000}
        rows={5}
        placeholder={f.placeholder || undefined}
        className="rounded-xl border border-line bg-bg px-3 py-2"
      />
    );
  if (f.kind === "choice" || f.kind === "yesno")
    return (
      <select {...common} defaultValue={value ?? ""} className={field}>
        <option value="" disabled>
          Choose…
        </option>
        {(f.kind === "yesno" ? ["Yes", "No"] : f.options).map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  return (
    <input
      {...common}
      type={f.kind === "email" ? "email" : f.kind === "phone" ? "tel" : "text"}
      maxLength={f.id === "name" ? 80 : 200}
      placeholder={f.placeholder || undefined}
      autoComplete={
        f.id === "name"
          ? "name"
          : f.kind === "email"
            ? "email"
            : f.kind === "phone"
              ? "tel"
              : undefined
      }
      className={field}
    />
  );
}

/** One of the owner's Contact Us forms; it lands in admin → Contact inbox tagged with its id. */
export function ContactForm({
  tab,
  prefill = {},
}: {
  tab: ContactTab;
  prefill?: Record<string, string>;
}) {
  const [state, action, pending] = useActionState(sendContact, null);
  if (state?.sent)
    return (
      <p
        role="status"
        className="rounded-xl border border-[var(--lit-line)] p-4 text-accent"
      >
        Sent. We&apos;ll reply to your email.
      </p>
    );
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="form" value={tab.id} />
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />
      {tab.fields.map((f) => (
        <label key={f.id} className="grid gap-1 text-sm font-bold">
          <span>
            {f.label}
            {!f.required && (
              <small className="ml-1 font-normal text-muted">(optional)</small>
            )}
          </span>
          <Input f={f} value={prefill[f.id]} />
        </label>
      ))}
      {state?.error && (
        <p role="alert" className="text-sm text-accent">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
