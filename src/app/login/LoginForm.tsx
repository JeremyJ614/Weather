"use client";

import { useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { supabaseBrowser } from "@/lib/supabase/browser";

const callback = (next: string) =>
  `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

export function LoginForm({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(
    null,
  );

  const google = async () => {
    setBusy(true);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback(next) },
    });
    if (error) {
      setBusy(false);
      setMsg({ text: error.message, error: true });
    }
  };

  const emailLink = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(
      new FormData(e.currentTarget).get("email") ?? "",
    ).trim();
    setBusy(true);
    setMsg(null);
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback(next) },
    });
    setBusy(false);
    setMsg(
      error
        ? { text: error.message, error: true }
        : {
            text: `Check ${email} for your sign-in link. It works once and expires in an hour.`,
          },
    );
  };

  return (
    <div className="grid gap-4">
      <Button variant="primary" onClick={google} disabled={busy}>
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
          <path
            fill="currentColor"
            d="M21.35 11.1H12v2.98h5.35c-.5 2.5-2.62 3.92-5.35 3.92a6 6 0 1 1 3.9-10.56l2.2-2.15A9.1 9.1 0 0 0 12 3a9 9 0 1 0 0 18c4.97 0 8.6-3.5 8.6-8.7 0-.42-.08-.83-.25-1.2Z"
          />
        </svg>
        Continue with Google
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <form className="grid gap-2" onSubmit={emailLink}>
        <label htmlFor="email" className="text-sm font-bold">
          Email me a sign-in link
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="min-h-11 rounded-xl border border-line bg-bg px-3"
        />
        <Button type="submit" disabled={busy}>
          <Mail className="size-4" aria-hidden /> Send link
        </Button>
      </form>
      {msg && (
        <p
          role="status"
          className={`text-sm ${msg.error ? "text-accent" : "text-muted"}`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
