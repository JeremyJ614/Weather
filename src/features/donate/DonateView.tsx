"use client";

import { useActionState, useEffect, useState } from "react";
import {
  CloudRain,
  HeartHandshake,
  Lock,
  Radar,
  Sparkles,
  Users,
} from "lucide-react";
import { dollars, PRESETS, toCents } from "@/lib/billing/donate";
import { startDonation } from "./actions";
import s from "./Donate.module.css";

export type Gift = {
  name: string | null;
  message: string | null;
  amount_cents: number;
  monthly: boolean;
  created_at: string;
};

/** Each preset carries a storm's name, smallest to biggest. */
const NAMES: Record<number, string> = {
  500: "Drizzle",
  1000: "Shower",
  2500: "Thunderstorm",
  5000: "Supercell",
  10000: "Derecho",
};

const ago = (iso: string) => {
  const d = Math.round((Date.now() - Date.parse(iso)) / 86400000);
  return d <= 0
    ? "today"
    : d === 1
      ? "yesterday"
      : d < 30
        ? `${d} days ago`
        : new Date(iso).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
};

/** A number that counts up once when the page opens (straight to the end for reduced motion). */
function useCount(to: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !to) {
      const id = requestAnimationFrame(() => setV(to));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 1400);
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return v;
}

function Thanks() {
  return (
    <section className={s.thanks} role="status">
      <div className={s.confetti} aria-hidden>
        {Array.from({ length: 28 }, (_, i) => (
          <i key={i} style={{ ["--i" as string]: i }} />
        ))}
      </div>
      <HeartHandshake className={s.thanksIcon} aria-hidden />
      <h2>Thank you!</h2>
      <p>
        Your gift keeps the radar spinning and the alerts flowing. A thank-you
        note is on its way to your inbox, and Stripe sends your receipt.
      </p>
    </section>
  );
}

/** The Donate page: the total so far, the giving form, where gifts go and the supporters wall. */
export function DonateView({
  thanks,
  open,
  totals,
  wall,
}: {
  thanks: boolean;
  open: boolean;
  totals: { cents: number; gifts: number; donors: number };
  wall: Gift[];
}) {
  const [monthly, setMonthly] = useState(false);
  const [preset, setPreset] = useState<number | null>(2500);
  const [custom, setCustom] = useState("");
  const [wallOn, setWallOn] = useState(false);
  const [state, action, pending] = useActionState(startDonation, null);
  useEffect(() => {
    if (state?.url) window.location.assign(state.url);
  }, [state]);
  const cents = preset ?? toCents(custom);
  const raised = useCount(Math.round(totals.cents / 100));
  const gifts = useCount(totals.gifts);
  const donors = useCount(totals.donors);

  return (
    <main className={s.page}>
      <section className={s.hero}>
        <div className={s.glow} aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <p className={s.kicker}>
          <HeartHandshake aria-hidden /> Support StormSync
        </p>
        <h1 className={s.title}>
          Keep the storms
          <br />
          <em>in view.</em>
        </h1>
        <p className={s.lede}>
          StormSync Weather is built by storm chasers and forecasters, not ad
          networks. Your gift, any amount, once or every month, keeps live
          radar, warnings and forecasts running for everyone, and funds what we
          build next.
        </p>
        <dl className={s.stats}>
          <div>
            <dt>Raised</dt>
            <dd>${raised.toLocaleString("en-US")}</dd>
          </div>
          <div>
            <dt>Gifts</dt>
            <dd>{gifts.toLocaleString("en-US")}</dd>
          </div>
          <div>
            <dt>Supporters</dt>
            <dd>{donors.toLocaleString("en-US")}</dd>
          </div>
        </dl>
      </section>

      {thanks && <Thanks />}

      <form action={action} className={s.card}>
        <div className={s.toggle} role="radiogroup" aria-label="How often">
          <button
            type="button"
            role="radio"
            aria-checked={!monthly}
            onClick={() => setMonthly(false)}
          >
            Give once
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={monthly}
            onClick={() => setMonthly(true)}
          >
            Give monthly
          </button>
        </div>
        {monthly && <input type="hidden" name="monthly" value="on" />}

        <fieldset className={s.presets}>
          <legend className={s.label}>Choose an amount</legend>
          {PRESETS.map((c) => (
            <label
              key={c}
              className={s.preset}
              data-on={preset === c || undefined}
            >
              <input
                type="radio"
                name="preset"
                value={c}
                checked={preset === c}
                onChange={() => setPreset(c)}
              />
              <b>{dollars(c)}</b>
              <small>{NAMES[c]}</small>
            </label>
          ))}
          <label className={s.preset} data-on={preset === null || undefined}>
            <input
              type="radio"
              name="preset"
              value=""
              checked={preset === null}
              onChange={() => setPreset(null)}
            />
            <b>Other</b>
            <small>Any amount</small>
          </label>
        </fieldset>

        {preset === null && (
          <label className={s.amount}>
            <span>$</span>
            <input
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="15"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              aria-label="Amount in dollars"
              autoFocus
            />
            <small>USD</small>
          </label>
        )}

        <details className={s.more}>
          <summary>Add a name and a note (optional)</summary>
          <div className={s.moreBody}>
            <label className={s.field}>
              <span>Your name</span>
              <input name="name" maxLength={60} autoComplete="name" />
            </label>
            <label className={s.field}>
              <span>A note</span>
              <textarea
                name="message"
                maxLength={200}
                rows={2}
                placeholder="Why you give, a storm you remember…"
              />
            </label>
            <label className={s.check}>
              <input
                type="checkbox"
                name="wall"
                checked={wallOn}
                onChange={(e) => setWallOn(e.target.checked)}
              />
              Show my name and note on the supporters wall
            </label>
          </div>
        </details>

        {state?.error && (
          <p role="alert" className={s.error}>
            {state.error}
          </p>
        )}
        <button
          type="submit"
          className={s.give}
          disabled={!open || pending || !cents || Boolean(state?.url)}
        >
          {pending || state?.url
            ? "Opening secure checkout…"
            : !open
              ? "Donations open soon"
              : cents
                ? `Give ${dollars(cents)}${monthly ? " every month" : ""}`
                : "Enter an amount"}
        </button>
        <p className={s.secure}>
          <Lock aria-hidden /> Secure payment by Stripe. We never see or store
          your card.{monthly ? " Change or stop a monthly gift any time." : ""}
        </p>
      </form>

      <section className={s.uses} aria-label="Where your gift goes">
        {[
          {
            icon: <Radar aria-hidden />,
            t: "Live data, always on",
            d: "Radar, warnings, outlooks and models pulled in around the clock, every minute a storm is on.",
          },
          {
            icon: <Sparkles aria-hidden />,
            t: "New tools",
            d: "The next forecast engines, replays and maps on the build list, built faster.",
          },
          {
            icon: <Users aria-hidden />,
            t: "Free for everyone",
            d: "The core weather stays free, so anyone can see what's coming, whatever they can pay.",
          },
        ].map((u) => (
          <article key={u.t}>
            {u.icon}
            <h3>{u.t}</h3>
            <p>{u.d}</p>
          </article>
        ))}
      </section>

      <section className={s.wall} aria-labelledby="wall-h">
        <h2 id="wall-h">
          <CloudRain aria-hidden /> Supporters wall
        </h2>
        {!wall.length ? (
          <p className={s.empty}>
            Be the first name here: add yours when you give.
          </p>
        ) : (
          <ul>
            {wall.map((g, i) => (
              <li key={`${g.created_at}-${i}`}>
                <b>{g.name}</b>
                <span className={s.amt}>
                  {dollars(g.amount_cents)}
                  {g.monthly ? " / month" : ""}
                </span>
                {g.message && <q>{g.message}</q>}
                <small>{ago(g.created_at)}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
