"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  Crown,
  Download,
  KeyRound,
  LogOut,
  Smartphone,
  Trash2,
} from "lucide-react";
import { manageBilling } from "@/app/join/actions";
import {
  changeMyPin,
  deleteMyAccount,
  exportMyData,
  signOutEverywhere,
  type AccState,
} from "./actions";
import s from "./Settings.module.css";

export type PlanSummary = {
  tier: string;
  cycle: "month" | "year" | null;
  status: string;
  comped: boolean;
  priceCents: number;
  addons: string[];
  billable: boolean;
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const STATUS: Record<string, string> = {
  free: "Free",
  awaiting_payment: "Waiting for payment",
  active: "Active",
  canceled: "Canceled",
};

/** Plan & billing, sign-in & security, installing the app, and the member's own data. */
export function AccountPanels({
  email,
  pinSet,
  plan,
}: {
  email: string;
  pinSet: boolean;
  plan: PlanSummary;
}) {
  return (
    <>
      <PlanCard plan={plan} />
      <SecurityCard email={email} pinSet={pinSet} />
      <InstallCard />
      <DataCard pinSet={pinSet} />
    </>
  );
}

function PlanCard({ plan }: { plan: PlanSummary }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <section className={s.card} aria-labelledby="plan-h">
      <header>
        <Crown aria-hidden />
        <div>
          <h2 id="plan-h">Plan &amp; billing</h2>
          <p>What you have, and where to change it.</p>
        </div>
      </header>
      <dl className={s.facts}>
        <div>
          <dt>Plan</dt>
          <dd>{plan.tier}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            {plan.comped
              ? "Complimentary"
              : (STATUS[plan.status] ?? plan.status)}
          </dd>
        </div>
        {plan.cycle && plan.priceCents > 0 && !plan.comped && (
          <div>
            <dt>Price</dt>
            <dd>
              {money(plan.priceCents)} a {plan.cycle}
            </dd>
          </div>
        )}
      </dl>
      {plan.addons.length > 0 && (
        <p className={s.note}>Add-ons: {plan.addons.join(", ")}</p>
      )}
      <div className={s.actions}>
        <Link href="/join" className={s.button}>
          {plan.status === "free" ? "See plans" : "Change plan or add pages"}
        </Link>
        {plan.billable && (
          <button
            type="button"
            className={s.button}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              const r = await manageBilling();
              if (r.url) location.href = r.url;
              else {
                setErr(r.error ?? "Billing couldn't open.");
                setBusy(false);
              }
            }}
          >
            {busy ? "Opening…" : "Cards, invoices & cancel"}
          </button>
        )}
      </div>
      {err && <p className={s.err}>{err}</p>}
      {plan.billable && (
        <p className={s.note}>
          Billing opens Stripe&rsquo;s own page. Canceling stops the next
          payment; you keep your plan to the end of the period you paid for,
          then move to Free with your account and history kept.
        </p>
      )}
    </section>
  );
}

function SecurityCard({ email, pinSet }: { email: string; pinSet: boolean }) {
  const [st, act, pending] = useActionState<AccState, FormData>(
    changeMyPin,
    null,
  );
  return (
    <section className={s.card} aria-labelledby="sec-h">
      <header>
        <KeyRound aria-hidden />
        <div>
          <h2 id="sec-h">Sign-in &amp; security</h2>
          <p>
            Signed in as <b>{email}</b>. To change your email,{" "}
            <Link href="/contact">contact us</Link>.
          </p>
        </div>
      </header>
      <form action={act} className={s.form}>
        <h3>{pinSet ? "Change your PIN" : "Set a PIN"}</h3>
        {pinSet && (
          <label>
            <span>Current PIN</span>
            <input
              name="current"
              type="password"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              autoComplete="current-password"
              required
            />
          </label>
        )}
        <label>
          <span>New PIN</span>
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          <span>New PIN again</span>
          <input
            name="pin2"
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            autoComplete="new-password"
            required
          />
        </label>
        <button type="submit" className={s.button} disabled={pending}>
          {pending ? "Saving…" : "Save PIN"}
        </button>
        {st?.error && <p className={s.err}>{st.error}</p>}
        {st?.ok && <p className={s.ok}>{st.ok}</p>}
      </form>
      <div className={s.actions}>
        <form action="/auth/signout" method="post">
          <button type="submit" className={s.button}>
            <LogOut aria-hidden /> Sign out
          </button>
        </form>
        <form action={signOutEverywhere}>
          <button type="submit" className={s.button}>
            Sign out on every device
          </button>
        </form>
      </div>
    </section>
  );
}

type Prompt = Event & { prompt: () => Promise<void> };

function InstallCard() {
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      setInstalled(
        matchMedia("(display-mode: standalone)").matches ||
          (navigator as unknown as { standalone?: boolean }).standalone ===
            true,
      );
      setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
      setAndroid(/android/i.test(navigator.userAgent));
    });
    const take = (e: Event) => {
      e.preventDefault();
      setPrompt(e as Prompt);
    };
    const done = () => setInstalled(true);
    addEventListener("beforeinstallprompt", take);
    addEventListener("appinstalled", done);
    return () => {
      removeEventListener("beforeinstallprompt", take);
      removeEventListener("appinstalled", done);
    };
  }, []);
  return (
    <section className={s.card} aria-labelledby="install-h">
      <header>
        <Smartphone aria-hidden />
        <div>
          <h2 id="install-h">Install the app</h2>
          <p>Full screen, its own icon, and alerts like any other app.</p>
        </div>
      </header>
      {installed ? (
        <p className={s.ok}>Installed on this device.</p>
      ) : prompt ? (
        <button
          type="button"
          className={s.button}
          onClick={async () => {
            await prompt.prompt();
            setPrompt(null);
          }}
        >
          Install StormSync Weather
        </button>
      ) : ios ? (
        <p className={s.note}>
          In Safari, tap the Share button, then <b>Add to Home Screen</b>.
        </p>
      ) : (
        <p className={s.note}>
          Open your browser&rsquo;s menu and choose <b>Install app</b> or{" "}
          <b>Add to Home screen</b>.
        </p>
      )}
      {!installed && android && (
        <p className={s.note}>
          Or{" "}
          <a href="/downloads/stormsync-weather.apk" download>
            download the Android app
          </a>{" "}
          (2.3 MB). Allow installs from your browser when Android asks.
        </p>
      )}
    </section>
  );
}

function DataCard({ pinSet }: { pinSet: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [st, act, pending] = useActionState<AccState, FormData>(
    deleteMyAccount,
    null,
  );
  return (
    <section className={s.card} aria-labelledby="data-h">
      <header>
        <Download aria-hidden />
        <div>
          <h2 id="data-h">Your data</h2>
          <p>Take a copy of everything we keep, or delete your account.</p>
        </div>
      </header>
      <div className={s.actions}>
        <button
          type="button"
          className={s.button}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            const r = await exportMyData();
            setBusy(false);
            if (!r.json) return setErr(r.error ?? "The export failed.");
            const a = document.createElement("a");
            a.href = URL.createObjectURL(
              new Blob([r.json], { type: "application/json" }),
            );
            a.download = "stormsync-my-data.json";
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          <Download aria-hidden /> {busy ? "Preparing…" : "Download my data"}
        </button>
        {!open && (
          <button
            type="button"
            className={s.danger}
            onClick={() => setOpen(true)}
          >
            <Trash2 aria-hidden /> Delete my account
          </button>
        )}
      </div>
      {err && <p className={s.err}>{err}</p>}
      {open && (
        <form action={act} className={s.form}>
          <h3>Delete my account</h3>
          <p className={s.note}>
            This removes your account, profile, points, badges, chases and alert
            settings for good, and cancels a paid plan so nothing bills again.
            It can&rsquo;t be undone.
          </p>
          {pinSet ? (
            <label>
              <span>Your PIN</span>
              <input
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                autoComplete="current-password"
                required
              />
            </label>
          ) : (
            <label>
              <span>Your email address</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
          )}
          <label>
            <span>Type DELETE to confirm</span>
            <input name="confirm" autoComplete="off" required />
          </label>
          <div className={s.actions}>
            <button type="submit" className={s.danger} disabled={pending}>
              {pending ? "Deleting…" : "Delete forever"}
            </button>
            <button
              type="button"
              className={s.button}
              onClick={() => setOpen(false)}
            >
              Keep my account
            </button>
          </div>
          {st?.error && <p className={s.err}>{st.error}</p>}
        </form>
      )}
    </section>
  );
}
