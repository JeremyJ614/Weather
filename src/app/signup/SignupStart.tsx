"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CornerDownLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { HumanCheck } from "@/features/account/HumanCheck";
import { signInWithGoogle } from "../login/actions";
import { startSignup } from "./actions";
import s from "../welcome/Interactive.module.css";

/** Email and a human check, then straight into the signup questions: no email to confirm. */
export function SignupStart({ next }: { next: string }) {
  const [start, startAction, startPending] = useActionState(startSignup, null);
  const [human, setHuman] = useState(false);
  const [g, googleAction, googlePending] = useActionState(
    signInWithGoogle,
    null,
  );
  const err = start?.error ?? g?.error;
  return (
    <div className={s.shell}>
      <div className={s.top}>
        <Link
          href="/"
          className="btn-dark inline-flex min-h-10 items-center gap-2 rounded-xl border border-line px-4 text-[13px] font-semibold"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back
        </Link>
        <Link
          href="?showcase"
          scroll={false}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-[12.5px] font-semibold text-accent"
        >
          <Sparkles className="size-4" aria-hidden /> See what you get
        </Link>
      </div>
      <div className={s.stage}>
        <section className={`${s.step} ${s.on}`}>
          <form id="signup-email" action={startAction} className="grid gap-5">
            <input type="hidden" name="next" value={next} />
            <h1 className={s.q}>
              <small>STEP 1 · YOUR EMAIL</small>
              What&apos;s your email?
            </h1>
            <p className={s.help}>
              No confirmation email: you&apos;ll go straight to a few quick
              questions, then pick your plan.
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
            <input
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="absolute -left-[9999px] h-px w-px opacity-0"
            />
            <HumanCheck onDone={setHuman} />
            {err && (
              <p role="alert" className={s.error}>
                {err}
              </p>
            )}
          </form>
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
            disabled={startPending || !human}
          >
            {startPending ? "Setting up…" : human ? "Continue" : "Checking…"}
          </Button>
        </div>
      </div>
    </div>
  );
}
