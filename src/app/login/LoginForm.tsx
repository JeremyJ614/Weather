"use client";

import { useActionState, useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { sendEmailLink, signInWithGoogle, signInWithPin } from "./actions";

const input = "min-h-11 w-full rounded-xl border border-line bg-bg px-3";

export function LoginForm({ next }: { next: string }) {
  const [pin, pinAction, pinPending] = useActionState(signInWithPin, null);
  const [g, googleAction, googlePending] = useActionState(
    signInWithGoogle,
    null,
  );
  const [link, linkAction, linkPending] = useActionState(sendEmailLink, null);
  const busy = pinPending || googlePending || linkPending;
  const [remember, setRemember] = useState(true);
  const keep = (
    <input type="hidden" name="remember" value={remember ? "1" : "0"} />
  );

  return (
    <div className="grid gap-4">
      <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 text-[13px]">
        <span>
          <b className="block">Remember this device</b>
          <span className="text-muted">
            Stay signed in here until you sign out.
          </span>
        </span>
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="size-5 accent-[var(--accent)]"
        />
      </label>
      <form action={googleAction}>
        <input type="hidden" name="next" value={next} />
        {keep}
        <Button
          type="submit"
          variant="primary"
          disabled={busy}
          className="w-full"
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path
              fill="currentColor"
              d="M21.35 11.1H12v2.98h5.35c-.5 2.5-2.62 3.92-5.35 3.92a6 6 0 1 1 3.9-10.56l2.2-2.15A9.1 9.1 0 0 0 12 3a9 9 0 1 0 0 18c4.97 0 8.6-3.5 8.6-8.7 0-.42-.08-.83-.25-1.2Z"
            />
          </svg>
          Continue with Google
        </Button>
        {g?.error && (
          <p role="alert" className="mt-2 text-sm text-accent">
            {g.error}
          </p>
        )}
      </form>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <form action={pinAction} className="grid gap-3">
        <input type="hidden" name="next" value={next} />
        {keep}
        <label className="grid gap-1 text-sm font-bold">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className={input}
          />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          PIN
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            autoComplete="current-password"
            className={input}
          />
        </label>
        {pin?.error && (
          <p role="alert" className="text-sm text-accent">
            {pin.error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {pinPending ? "Signing in…" : "Sign in with PIN"}
        </Button>
        <Button
          type="submit"
          variant="ghost"
          formAction={linkAction}
          formNoValidate
          disabled={busy}
        >
          <Mail className="size-4" aria-hidden /> New here or forgot your PIN?
          Email me a link
        </Button>
      </form>
      {link && (
        <p
          role="status"
          className={`text-sm ${link.error ? "text-accent" : "text-muted"}`}
        >
          {link.error ??
            `Check ${link.sent} for your sign-in link. It works once and expires in an hour.`}
        </p>
      )}
    </div>
  );
}
