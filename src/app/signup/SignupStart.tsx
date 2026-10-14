"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { sendEmailLink, signInWithGoogle } from "../login/actions";
import s from "../welcome/Interactive.module.css";

/** Email first: a one-time link proves it, then the signup questions begin. */
export function SignupStart({ next }: { next: string }) {
  const [link, linkAction, linkPending] = useActionState(sendEmailLink, null);
  const [g, googleAction, googlePending] = useActionState(
    signInWithGoogle,
    null,
  );
  const err = link?.error ?? g?.error;
  return (
    <div className={s.shell}>
      <div className={s.top}>
        <Link
          href="/"
          className="btn-dark inline-flex min-h-10 items-center gap-2 rounded-xl border border-line px-4 text-[13px] font-semibold"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back
        </Link>
        <span className={s.count}>SIGN UP</span>
      </div>
      <div className={s.stage}>
        <section className={`${s.step} ${s.on}`}>
          {link?.sent ? (
            <>
              <h1 className={s.q}>
                <small>CHECK YOUR EMAIL</small>
                Tap the link we sent to {link.sent}
              </h1>
              <p className={s.help}>
                It opens your signup questions. It works once and expires in an
                hour.
              </p>
            </>
          ) : (
            <form id="signup-email" action={linkAction} className="grid gap-5">
              <input type="hidden" name="next" value={next} />
              <h1 className={s.q}>
                <small>STEP 1 · YOUR EMAIL</small>
                What&apos;s your email?
              </h1>
              <p className={s.help}>
                We&apos;ll send a link to confirm it&apos;s yours.
              </p>
              <input
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                autoFocus
                placeholder="you@example.com"
                className={s.field}
              />
              {err && (
                <p role="alert" className={s.error}>
                  {err}
                </p>
              )}
            </form>
          )}
          <form action={googleAction}>
            <input type="hidden" name="next" value={next} />
            <Button
              type="submit"
              className="w-auto"
              still="under"
              disabled={googlePending}
            >
              {googlePending ? "Opening Google…" : "Or continue with Google"}
            </Button>
          </form>
          <p className="text-sm text-muted">
            Have an account?{" "}
            <Link href="/login" className="text-accent underline">
              Log in
            </Link>
            . By continuing you agree to our{" "}
            <Link href="/privacy" className="text-accent underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </div>
      <div className={s.foot}>
        <span />
        {!link?.sent && (
          <div className="flex items-center gap-3">
            <span className={s.enter}>
              or press Enter{" "}
              <CornerDownLeft className="inline size-3" aria-hidden />
            </span>
            <Button
              type="submit"
              form="signup-email"
              variant="primary"
              className="w-auto px-6"
              disabled={linkPending}
            >
              {linkPending ? "Sending…" : "Continue"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
