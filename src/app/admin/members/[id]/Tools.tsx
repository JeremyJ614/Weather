"use client";

import { useActionState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { removeMember, resetPin } from "../actions";

const field = "min-h-11 w-full rounded-xl border border-line bg-bg px-3";

/** Member tools ported from VIP: set a new PIN, remove the account. */
export function Tools({ id, name }: { id: string; name: string }) {
  const [pin, pinAction, pinPending] = useActionState(resetPin, null);
  const [del, delAction, delPending] = useActionState(removeMember, null);
  return (
    <div className="grid gap-3">
      <form
        action={pinAction}
        className="grid gap-2 rounded-2xl border border-line bg-surface p-4"
      >
        <input type="hidden" name="userId" value={id} />
        <b className="flex items-center gap-2">
          <KeyRound className="size-4 text-accent" aria-hidden /> Set a new PIN
        </b>
        <div className="flex gap-2">
          <input
            name="pin"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            required
            aria-label="New PIN"
            autoComplete="off"
            className={`${field} mono flex-1 tracking-[.4em]`}
          />
          <Button type="submit" disabled={pinPending}>
            {pinPending ? "Saving…" : "Save PIN"}
          </Button>
        </div>
        {pin && (
          <p role="status" className="text-sm text-accent">
            {pin.error ?? pin.ok}
          </p>
        )}
      </form>
      <details className="rounded-2xl border border-line bg-surface p-4">
        <summary className="flex cursor-pointer items-center gap-2 font-bold">
          <Trash2 className="size-4 text-accent" aria-hidden /> Remove account
        </summary>
        <form action={delAction} className="mt-3 grid gap-2">
          <input type="hidden" name="userId" value={id} />
          <p className="text-sm text-muted">
            Removes {name}&apos;s sign-in, profile, game rounds, points and
            answers. This can&apos;t be undone. Type their full name to confirm.
          </p>
          <input
            name="confirm"
            aria-label="Type their full name"
            placeholder={name}
            className={field}
          />
          <Button
            type="submit"
            variant="ghost"
            disabled={delPending}
            className="text-accent"
          >
            {delPending ? "Removing…" : `Remove ${name}`}
          </Button>
          {del?.error && (
            <p role="alert" className="text-sm text-accent">
              {del.error}
            </p>
          )}
        </form>
      </details>
    </div>
  );
}
