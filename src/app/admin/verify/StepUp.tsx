"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { sendEmailLink, signInWithGoogle } from "@/app/login/actions";

export function StepUp() {
  const [g, googleAction, gp] = useActionState(signInWithGoogle, null);
  const [link, linkAction, lp] = useActionState(sendEmailLink, null);
  return (
    <div className="grid gap-3">
      <form action={googleAction}>
        <input type="hidden" name="next" value="/admin" />
        <Button
          type="submit"
          variant="primary"
          disabled={gp || lp}
          className="w-full"
        >
          Continue with Google
        </Button>
      </form>
      <form action={linkAction} className="grid gap-2">
        <input type="hidden" name="next" value="/admin" />
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          aria-label="Email"
          placeholder="Email"
          className="min-h-11 rounded-xl border border-line bg-bg px-3"
        />
        <Button type="submit" disabled={gp || lp}>
          Email me a link
        </Button>
      </form>
      {(g?.error || link) && (
        <p role="status" className="text-sm text-muted">
          {g?.error ?? link?.error ?? `Check ${link?.sent} for your link.`}
        </p>
      )}
    </div>
  );
}
