"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { addRelease } from "./actions";

const field = "min-h-11 rounded-xl border border-line bg-bg px-3";

export function ReleaseForm() {
  const [state, action, pending] = useActionState(addRelease, null);
  return (
    <form
      action={action}
      className="grid gap-3 rounded-2xl border border-line bg-surface p-4"
    >
      <div className="grid grid-cols-[6rem_1fr] gap-2">
        <input
          name="version"
          required
          placeholder="1.0.0"
          aria-label="Version"
          className={field}
        />
        <input
          name="title"
          required
          maxLength={120}
          placeholder="What's new"
          aria-label="Title"
          className={field}
        />
      </div>
      <textarea
        name="notes"
        rows={5}
        maxLength={4000}
        placeholder="Notes (- bullet lists, **bold**, links)"
        aria-label="Notes"
        className={`${field} py-2`}
      />
      {state && (
        <p role="status" className="text-sm text-accent">
          {state.error ?? "Published to App Updates."}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Publishing…" : "Publish release"}
      </Button>
    </form>
  );
}
