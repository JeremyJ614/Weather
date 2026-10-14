"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { sendContact } from "./actions";

const field = "min-h-11 w-full rounded-xl border border-line bg-bg px-3";

/** A message to the team. `form` names which form it came from in the inbox. */
export function ContactForm({
  form,
  name = "",
  email = "",
  subject = "",
}: {
  form: string;
  name?: string;
  email?: string;
  subject?: string;
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
      <input type="hidden" name="form" value={form} />
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="name"
          required
          maxLength={80}
          defaultValue={name}
          placeholder="Your name"
          aria-label="Your name"
          autoComplete="name"
          className={field}
        />
        <input
          name="email"
          type="email"
          required
          maxLength={200}
          defaultValue={email}
          placeholder="Your email"
          aria-label="Your email"
          autoComplete="email"
          className={field}
        />
      </div>
      <input
        name="subject"
        maxLength={120}
        defaultValue={subject}
        placeholder="Subject (optional)"
        aria-label="Subject"
        className={field}
      />
      <textarea
        name="body"
        required
        maxLength={4000}
        rows={5}
        placeholder="Your message"
        aria-label="Your message"
        className="rounded-xl border border-line bg-bg px-3 py-2"
      />
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
