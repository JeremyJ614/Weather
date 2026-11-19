"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Crown } from "lucide-react";
import { startVipMonths } from "./actions";
import s from "./VipOffer.module.css";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/**
 * Fix It List #36, 4: an Academy Lifetime VIP lands here (no plan picking) and starts two free months of VIP with a
 * card on file. `gate` shows the same offer as a pop up over sign up, before the account exists.
 */
export function VipOffer({
  code,
  price,
  open,
  gate,
}: {
  code: string;
  price: number | null;
  open: boolean;
  gate?: { login: string };
}) {
  const [shown, setShown] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!shown) return null;
  const perks = (
    <ul className={s.list}>
      <li>
        <Check className="size-4" aria-hidden /> Every VIP page and tool, free
        for two whole months
      </li>
      <li>
        <Check className="size-4" aria-hidden /> Your card is kept on file;
        nothing is charged for two months
      </li>
      <li>
        <Check className="size-4" aria-hidden /> Then VIP renews monthly
        {price ? ` at ${money(price)}` : ""}, unless you cancel first (any time,
        in Settings)
      </li>
      <li>
        <Check className="size-4" aria-hidden /> Code {code}: one use, yours
        only
      </li>
    </ul>
  );
  const body = !open ? (
    <>
      <h2>This code has been used</h2>
      <p>
        Code {code} was already used, or it isn&apos;t an Academy VIP code. Each
        Lifetime VIP gets their own code in their Academy profile.
      </p>
      <Link className={s.go} href="/join">
        See the plans
      </Link>
    </>
  ) : gate ? (
    <>
      <h2>
        You&apos;re eligible for 2 100% Free Months of the VIP Subscription!
      </h2>
      <p>
        A thank you for your StormSync Academy Lifetime VIP Pass. Sign up now to
        take the offer: no plan picking, straight to your free months.
      </p>
      {perks}
      <button type="button" className={s.go} onClick={() => setShown(false)}>
        Sign up now
      </button>
      <Link className={s.ghost} href={gate.login}>
        I already have an account
      </Link>
    </>
  ) : (
    <>
      <h1>Your 2 free months of VIP</h1>
      <p>A thank you for your StormSync Academy Lifetime VIP Pass.</p>
      {perks}
      {err && (
        <p className={s.err} role="alert">
          {err}
        </p>
      )}
      <button
        type="button"
        className={s.go}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr("");
          const r = await startVipMonths(code);
          if ("url" in r) {
            location.href = r.url;
            return;
          }
          setErr(r.error);
          setBusy(false);
        }}
      >
        {busy ? "Opening checkout…" : "Start my 2 free months"}
      </button>
      <p className={s.fine}>
        Checkout asks for a card so VIP can continue after the free months. You
        are not charged today.
      </p>
    </>
  );
  return (
    <div
      className={s.scrim}
      role="dialog"
      aria-modal="true"
      aria-label="Two free months of VIP"
    >
      <section className={s.card}>
        <span className={s.crown}>
          <Crown className="size-5" aria-hidden />
        </span>
        <p className={s.kicker}>StormSync Media VIP</p>
        {body}
      </section>
    </div>
  );
}
