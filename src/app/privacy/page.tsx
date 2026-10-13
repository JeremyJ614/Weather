import { ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · StormSync Media",
  description:
    "What StormSync Weather collects, why, and how to have it deleted.",
};

const UPDATED = "October 13, 2026";
const CONTACT = "jaywx@yahoo.com";

const sections: { h: string; body: React.ReactNode }[] = [
  {
    h: "Who we are",
    body: (
      <p>
        StormSync Weather (Weather.SSWX.Space) is run by StormSync Media. This
        policy covers the website and the installed app.
      </p>
    ),
  },
  {
    h: "What we collect",
    body: (
      <ul>
        <li>
          <b>Your account:</b> first and last name, optional nickname, email,
          optional phone number, city and state, birthday (to confirm you are 18
          or older), how you found us, and the referral code you entered.
        </li>
        <li>
          <b>Sign in with Google:</b> your name, email address and profile
          picture. We never see your Google password.
        </li>
        <li>
          <b>Location:</b> if you allow it, your device location is used to show
          your local weather. Places you save (up to five) are stored with your
          account. We do not track your location in the background.
        </li>
        <li>
          <b>What you do in the app:</b> game picks, trivia answers, poll votes,
          leaderboard points, chase logs (private unless you share them) and
          your notification choices.
        </li>
        <li>
          <b>Settings on your device:</b> theme, menu and intro choices are
          stored on your device, not on our servers.
        </li>
      </ul>
    ),
  },
  {
    h: "How we use it",
    body: (
      <p>
        To run your account, show weather for your places, send the alerts,
        briefs and emails you turn on, run games and leaderboards, credit
        referrals, keep the service secure, and fix problems. We do not sell
        your information, and we do not show third-party ads.
      </p>
    ),
  },
  {
    h: "Services that handle data for us",
    body: (
      <ul>
        <li>Supabase: database and sign-in.</li>
        <li>Vercel: hosting.</li>
        <li>Google: sign-in, if you choose it.</li>
        <li>Resend: email delivery.</li>
        <li>
          Mapbox and OpenFreeMap: map tiles. Like any website, they receive your
          IP address when a map loads.
        </li>
        <li>
          Stripe: payments for paid plans. We never see or store your card
          number.
        </li>
        <li>
          Google Gemini: writes weather summaries from public forecast text.
          Your personal information is not sent to it.
        </li>
      </ul>
    ),
  },
  {
    h: "Cookies",
    body: (
      <p>
        We use only the cookies needed to keep you signed in. There are no
        advertising or cross-site tracking cookies.
      </p>
    ),
  },
  {
    h: "How long we keep it",
    body: (
      <p>
        Account information is kept while your account is open. When you ask us
        to delete your account, we delete your personal information within 30
        days, except where the law requires us to keep a record (for example,
        payment records).
      </p>
    ),
  },
  {
    h: "Your choices",
    body: (
      <p>
        You can see and change your profile, turn notifications on or off, and
        turn off location access in your device settings at any time. To get a
        copy of your information or delete your account, email{" "}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    ),
  },
  {
    h: "Security",
    body: (
      <p>
        Every database table is locked so each person can reach only what they
        are allowed to. Secret keys stay on our servers. Your sign-in PIN is
        never stored; only a scrambled value that cannot be reversed is kept.
      </p>
    ),
  },
  {
    h: "Age",
    body: <p>Accounts are for people 18 and older.</p>,
  },
  {
    h: "Changes",
    body: (
      <p>
        If this policy changes, we will update the date below and, for
        significant changes, tell members in the app.
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-4 pt-6 pb-24">
      <PageHero
        icon={<ShieldCheck aria-hidden />}
        eyebrow={["StormSync Media"]}
        title="Privacy Policy"
        subtitle={`Last updated ${UPDATED}`}
      />
      <div className="mt-2 text-sm grid gap-7 leading-relaxed text-muted [&_a]:text-accent [&_a]:underline [&_b]:text-text [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">
        {sections.map((s) => (
          <section key={s.h}>
            <h2 className="mb-2 text-lg font-bold text-accent">{s.h}</h2>
            {s.body}
          </section>
        ))}
        <section>
          <h2 className="mb-2 text-lg font-bold text-accent">Contact</h2>
          <p>
            StormSync Media · <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
          </p>
        </section>
      </div>
    </main>
  );
}
