"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import type { SignupForm } from "@/lib/auth/signup-form";
import { saveSignupForm } from "../actions";

const LABELS: [keyof SignupForm["show"], string][] = [
  ["nickname", "Nickname (and “use it as my name”)"],
  ["phone", "Phone number"],
  ["foundUs", "How did you find us?"],
  ["referral", "Referred by an SSWX Member?"],
];

export function FormEditor({ form }: { form: SignupForm }) {
  const [state, action, pending] = useActionState(saveSignupForm, null);
  return (
    <form action={action} className="grid gap-4">
      <fieldset className="grid gap-2 rounded-2xl border border-line bg-surface p-4">
        <legend className="px-1 text-sm text-muted">
          Optional questions shown
        </legend>
        {LABELS.map(([k, label]) => (
          <label
            key={k}
            className="flex items-center justify-between gap-3 text-sm"
          >
            {label}
            <input
              type="checkbox"
              name={k}
              defaultChecked={form.show[k]}
              className="size-5 accent-[var(--accent)]"
            />
          </label>
        ))}
        <p className="text-xs text-muted">
          Name, city, state, birthday (18+) and PIN are always asked.
        </p>
      </fieldset>
      <label className="grid gap-1 rounded-2xl border border-line bg-surface p-4 text-sm">
        <span className="font-bold">“How did you find us?” choices</span>
        <span className="text-xs text-muted">
          One per line. Leave empty to let people type an answer.
        </span>
        <textarea
          name="options"
          defaultValue={form.foundUsOptions.join("\n")}
          rows={5}
          className="rounded-xl border border-line bg-bg px-3 py-2"
        />
      </label>
      <label className="grid gap-1 rounded-2xl border border-line bg-surface p-4 text-sm">
        <span className="font-bold">Welcome note (optional)</span>
        <textarea
          name="intro"
          defaultValue={form.intro}
          maxLength={300}
          rows={3}
          className="rounded-xl border border-line bg-bg px-3 py-2"
        />
      </label>
      {state && (
        <p role="status" className="text-sm text-accent">
          {state.error ?? "Saved. New signups see this form now."}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : "Save form"}
      </Button>
    </form>
  );
}
