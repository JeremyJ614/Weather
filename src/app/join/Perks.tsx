"use client";

import { useActionState, useState } from "react";
import { BadgeCheck, Clock, Crown, Shield, Ticket } from "lucide-react";
import { askResponder, buyDayPass, startTrial } from "./actions";
import s from "./Perks.module.css";

export type PerksData = {
  signedIn: boolean;
  founder: { left: number; of: number } | null;
  trial: { eligible: boolean; days: number; price: number } | null;
  dayPass: {
    price: number;
    hours: number;
    until: number | null;
    /** Running right now (worked out on the server). */
    active: boolean;
    credit: number;
  } | null;
  responder: {
    pct: number;
    status: "none" | "pending" | "approved" | "declined";
  } | null;
  justBought: boolean;
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const ROLES = [
  "SKYWARN spotter",
  "Firefighter",
  "EMS",
  "Police",
  "Emergency manager",
  "Other first responder",
];

/**
 * Post-launch A4 offers on the Join page: Founding Member spots, the 7-day VIP trial, the
 * Storm Day Pass and the spotter / first-responder discount. Each shows only while the owner
 * has it switched on (admin → Pricing → Promotions).
 */
export function Perks({ d }: { d: PerksData }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [state, act, sending] = useActionState(askResponder, {});
  if (!d.founder && !d.trial && !d.dayPass && !d.responder) return null;
  const go = async (
    k: string,
    fn: () => Promise<{ error?: string; url?: string } | object>,
  ) => {
    setBusy(k);
    setErr(null);
    const r = (await fn()) as { error?: string; url?: string };
    if (r.url) location.href = r.url;
    else {
      setErr(r.error ?? "Something went wrong. Try again.");
      setBusy(null);
    }
  };
  const passOn = Boolean(d.dayPass?.active && d.dayPass.until);
  return (
    <section className={s.perks} aria-label="Offers">
      {d.founder && (
        <article className={s.card} data-tone="gold">
          <Crown aria-hidden />
          <div>
            <h3>Founding Members</h3>
            <p>
              The first {d.founder.of} paid members keep their price for as long
              as they stay, and get the gold Founder badge.
            </p>
            <div
              className={s.spots}
              aria-label={`${d.founder.left} spots left`}
            >
              <i
                style={{
                  transform: `scaleX(${d.founder.left / d.founder.of})`,
                }}
              />
            </div>
            <b className={s.count}>
              {d.founder.left} of {d.founder.of} spots left
            </b>
          </div>
        </article>
      )}
      {d.trial && (
        <article className={s.card}>
          <BadgeCheck aria-hidden />
          <div>
            <h3>Try VIP free for {d.trial.days} days</h3>
            <p>
              Every page, card on file, then {money(d.trial.price)} a month.
              Cancel any time in one tap; we remind you before it ends.
            </p>
            {d.trial.eligible ? (
              <button
                type="button"
                className={s.btn}
                disabled={!d.signedIn || busy !== null}
                onClick={() => go("trial", startTrial)}
              >
                {busy === "trial"
                  ? "Opening checkout…"
                  : d.signedIn
                    ? "Start my free trial"
                    : "Sign in to start"}
              </button>
            ) : (
              <small className={s.muted}>
                The trial is for members who haven&apos;t had a paid plan yet.
              </small>
            )}
          </div>
        </article>
      )}
      {d.dayPass && (
        <article className={s.card}>
          <Ticket aria-hidden />
          <div>
            <h3>Storm Day Pass</h3>
            {passOn ? (
              <p className={s.on}>
                <Clock aria-hidden /> Your pass is on until{" "}
                {new Date(d.dayPass.until!).toLocaleTimeString("en-US", {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                . Every page is open.
              </p>
            ) : (
              <p>
                {money(d.dayPass.price)} for {d.dayPass.hours} hours of
                everything, VIP included. For the one big day.
                {d.dayPass.credit > 0 &&
                  ` Your last pass takes ${money(d.dayPass.credit)} off your first month.`}
              </p>
            )}
            {!passOn && (
              <button
                type="button"
                className={s.btn}
                disabled={!d.signedIn || busy !== null}
                onClick={() => go("pass", buyDayPass)}
              >
                {busy === "pass"
                  ? "Opening checkout…"
                  : d.signedIn
                    ? `Get a Day Pass · ${money(d.dayPass.price)}`
                    : "Sign in to buy"}
              </button>
            )}
          </div>
        </article>
      )}
      {d.responder && (
        <article className={s.card}>
          <Shield aria-hidden />
          <div>
            <h3>Spotters and first responders</h3>
            <p>
              {d.responder.pct}% off any plan for as long as you have it:
              SKYWARN spotters, firefighters, EMS, police and emergency
              managers.
            </p>
            {d.responder.status === "approved" ? (
              <p className={s.on}>
                You&apos;re approved. The discount is applied at checkout.
              </p>
            ) : d.responder.status === "pending" || state.ok ? (
              <p className={s.on}>
                {state.ok ?? "Your request is in. We'll let you know soon."}
              </p>
            ) : d.signedIn ? (
              <form action={act} className={s.form}>
                <label>
                  Role
                  <select name="role" defaultValue="" required>
                    <option value="" disabled>
                      Choose…
                    </option>
                    {ROLES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Agency, department or spotter ID
                  <input name="agency" maxLength={120} required />
                </label>
                <label>
                  Photo of your ID or spotter card
                  <input name="photo" type="file" accept="image/*" required />
                </label>
                {state.error && <small className={s.err}>{state.error}</small>}
                <button type="submit" className={s.btn} disabled={sending}>
                  {sending ? "Sending…" : "Ask for the discount"}
                </button>
                <small className={s.muted}>
                  Only the team sees the photo, and only to check it.
                </small>
              </form>
            ) : (
              <small className={s.muted}>Sign in to ask for it.</small>
            )}
          </div>
        </article>
      )}
      {err && (
        <p className={s.err} role="alert">
          {err}
        </p>
      )}
    </section>
  );
}
