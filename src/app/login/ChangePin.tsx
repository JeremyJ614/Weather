"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { changePin } from "./actions";

const input = "min-h-11 w-full rounded-xl border border-line bg-bg px-3";
const pinInput = {
  type: "password",
  inputMode: "numeric",
  pattern: "[0-9]{4}",
  maxLength: 4,
  required: true,
  autoComplete: "new-password",
  className: input,
} as const;

export function ChangePin() {
  const [state, action, pending] = useActionState(changePin, null);
  return (
    <form action={action} className="grid gap-2">
      <p className="text-sm font-bold">Set a new PIN</p>
      <div className="grid grid-cols-2 gap-2">
        <input name="pin" aria-label="New PIN" {...pinInput} />
        <input name="pin2" aria-label="Repeat new PIN" {...pinInput} />
      </div>
      {state && (
        <p
          role="status"
          className={`text-sm ${state.error ? "text-accent" : "text-muted"}`}
        >
          {state.error ?? "Your new PIN is saved."}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save PIN"}
      </Button>
    </form>
  );
}
