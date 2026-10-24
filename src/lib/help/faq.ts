/**
 * The FAQ the owner edits (admin → FAQ): tabs, each with its own sections, each with its
 * own questions. Saved as app_config `faq`; `cleanFaq` rebuilds whatever is saved so a bad
 * edit can never break the page. Answers are plain text: a blank line starts a new
 * paragraph and [words](/page) makes a link.
 */
export type FaqItem = { id: string; q: string; a: string };
export type FaqSection = { id: string; title: string; items: FaqItem[] };
export type FaqTab = { id: string; title: string; sections: FaqSection[] };
export type Faq = { intro: string; tabs: FaqTab[] };

export const FAQ_LIMITS = {
  tabs: 12,
  sections: 12,
  items: 40,
  q: 200,
  a: 3000,
};

let n = 0;
const id = (p: string) => `${p}${(n++).toString(36)}`;
const item = (q: string, a: string): FaqItem => ({ id: id("q"), q, a });
const section = (title: string, items: FaqItem[]): FaqSection => ({
  id: id("s"),
  title,
  items,
});
const tab = (title: string, sections: FaqSection[]): FaqTab => ({
  // Readable ids, so a link can open a tab: /faq?tab=plans-billing
  id: title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, ""),
  title,
  sections,
});

export const DEFAULT_FAQ: Faq = {
  intro:
    "Answers to what members ask most. Can't find yours? [Contact us](/contact) and we'll reply by email.",
  tabs: [
    tab("Getting started", [
      section("The basics", [
        item(
          "What is StormSync Weather?",
          "StormSync Weather is a weather app built by storm chasers and forecasters. It pulls live data straight from NOAA, the National Weather Service, the Storm Prediction Center, the National Hurricane Center and NASA, and turns it into outlooks, maps and tools you can read at a glance.\n\nIt works in any browser, installs like an app on your phone, and every page is built for a phone first.",
        ),
        item(
          "Is it free?",
          "Yes. The Free plan is free forever and includes the homepage, news, the dashboard, radar and model runs, the SPC outlooks, games, polls, the glossary and more. Paid plans open more pages. See [Plans & Pricing](/join) for exactly what each one includes.",
        ),
        item(
          "Do I need an account?",
          "You can look around a few pages without one. An account (free) unlocks the rest of the Free plan, saves your location and settings, and lets you earn points and badges. [Sign up](/signup) takes about a minute.",
        ),
      ]),
      section("Installing the app", [
        item(
          "How do I install it on my phone?",
          "On Android, open the site in Chrome, open the menu and choose Install app (or Add to Home screen), or [download the Android app](/downloads/stormsync-weather.apk) and allow installs from your browser when asked. On iPhone, open it in Safari, tap Share, then Add to Home Screen.\n\nInstalled, it opens full screen with its own icon and can send you alerts like any other app. Account Settings has an Install button when your browser offers one.",
        ),
        item(
          "Does it work without a connection?",
          "The app's own code is kept on your phone, so it opens fast. Weather data is live, so it needs a connection: without one, the app shows an offline notice and picks up where you left off once you're back.",
        ),
      ]),
      section("Finding your way around", [
        item(
          "Where are all the pages?",
          "Everything lives in the main menu, grouped by what it's for: Localized Data, Severe Weather, Tools & Data, Specialty Monitoring, Educational and more. The second menu holds quick shortcuts. You can change how both menus look in [Account Settings](/settings).",
        ),
        item(
          "Some pages say they're still being built. Why?",
          "A page that hasn't been built yet says so plainly instead of showing a fake screen. It tells you which phase of the build it's in, and it opens the day it's ready.",
        ),
      ]),
    ]),
    tab("Plans & billing", [
      section("Plans", [
        item(
          "What's the difference between the plans?",
          "Free covers the essentials. Basic adds your daily weather tools (the daily brief, air quality and pollen, daylight and more). Storm Chasers adds everything for the chase. Advanced is the full forecaster's desk. VIP opens every page, including new ones as they launch.\n\n[Plans & Pricing](/join) lists every page in every plan.",
        ),
        item(
          "Which pages come with every plan?",
          "The homepage, news, Disaster Response, FAQ, Contact Us, Plans & Pricing, sign-in, privacy, and your own account pages (profile, settings, notifications) are in every plan, free included. They are never sold as add-ons.",
        ),
        item(
          "Can I add just one page instead of a whole plan?",
          "Yes. Most pages can be added on their own to any plan for a small monthly price. Pick them on [Plans & Pricing](/join).",
        ),
        item(
          "Monthly or yearly?",
          "Either. Yearly costs less than twelve months of monthly. You can switch at any time from Plans & Pricing.",
        ),
      ]),
      section("Paying and canceling", [
        item(
          "How do I pay?",
          "Payments go through Stripe, so your card number never touches our servers. You'll get an emailed invoice for each payment.",
        ),
        item(
          "How do I cancel?",
          "Open [Account Settings](/settings), then Cards, invoices & cancel. Canceling stops the next payment. You keep your plan until the end of the period you paid for, then move to Free with your account, points and history kept.",
        ),
        item(
          "How do I update my card or see old invoices?",
          "Account Settings → Cards, invoices & cancel opens Stripe's own billing page, where you can change your card and download every invoice.",
        ),
      ]),
    ]),
    tab("Weather & data", [
      section("Where the data comes from", [
        item(
          "Where does your weather data come from?",
          "Straight from the source: the National Weather Service (warnings, forecasts, discussions), the Storm Prediction Center (outlooks, mesoscale discussions, storm reports), the National Hurricane Center, NOAA's MRMS radar system, NOAA's weather models (HRRR, GFS and others), and NASA's satellites. Each page says what it uses.",
        ),
        item(
          "How often does it update?",
          "As often as the source does. Radar and warnings refresh every few minutes, SPC outlooks when SPC issues them, and model maps when each new model run arrives. Pages show the time their data was issued.",
        ),
        item(
          "Is this an official warning service?",
          "No. StormSync Weather explains and maps official data, but it is not the National Weather Service. Always follow the warnings your local NWS office issues and your local officials' instructions.",
        ),
      ]),
      section("Outlooks and tools", [
        item(
          "What is the Storm Chasing Outlook?",
          "A daily score for how good the chase is and where, built from SPC's outlooks and the latest model runs: instability, shear, moisture, storm mode and the odds of a bust. The Yearly tab ranks today against every other day this year.",
        ),
        item(
          "What are the Weather Engines on Extras?",
          'Experimental tools computed from NOAA data, like ProbTor, the significant tornado and supercell composites, radar blind spots and lightning threat. Each one has a "How this works" note explaining exactly what it does and where it can be wrong. They\'re for learning and situational awareness, not for safety decisions.',
        ),
      ]),
    ]),
    tab("Alerts & notifications", [
      section("Setting up alerts", [
        item(
          "How do I turn on alerts?",
          "Open [Notifications](/notifications), choose the topics you want (warnings for your place, outlooks, tropical, aurora and more), and allow notifications when your browser asks. On iPhone, install the app to your Home Screen first; iOS only sends alerts to installed apps.",
        ),
        item(
          "Can I stop alerts at night?",
          "Yes. Set quiet hours on the Notifications page and nothing but the most urgent warnings will come through while you sleep.",
        ),
      ]),
      section("When alerts don't arrive", [
        item(
          "I'm not getting alerts. What should I check?",
          "Make sure notifications are allowed for this site (or the installed app) in your phone's settings, that battery saver isn't stopping background apps, and that your place is set on the Notifications page. Still nothing? [Contact us](/contact?tab=support).",
        ),
      ]),
    ]),
    tab("Account & privacy", [
      section("Your account", [
        item(
          "How do I sign in?",
          "With your email and the 4-digit PIN you chose when you joined. You can change your PIN in [Account Settings](/settings).",
        ),
        item(
          "I forgot my PIN.",
          "On the [sign-in page](/login), tap “New here or forgot your PIN?” and we'll email you a link to get back in. Then set a new PIN in Account Settings.",
        ),
        item(
          "Can I change my email address?",
          "Email changes go through us so nobody can take over an account. [Contact us](/contact?tab=support) from the address you joined with.",
        ),
      ]),
      section("Privacy", [
        item(
          "What do you do with my data?",
          "We keep only what the app needs: your account, settings, place, points and the chases you save. We never sell it. The [privacy page](/privacy) has the details.",
        ),
        item(
          "Can I download or delete my data?",
          "Yes. Account Settings → Your data lets you download everything we keep about you, or delete your account for good (a paid plan is canceled so nothing bills again).",
        ),
      ]),
    ]),
    tab("Troubleshooting", [
      section("Something's not working", [
        item(
          "A page won't load or looks wrong.",
          "Close and reopen the app, or reload the page. If it still fails, the source may be down for a moment (NOAA's servers sometimes are); most pages say so and try again on their own. If it keeps happening, [tell us](/contact?tab=support) which page and what you see.",
        ),
        item(
          "The maps are slow on my phone.",
          "The app measures your phone and dials effects down on slower ones. You can also turn on reduced motion in your phone's accessibility settings, which turns off non-essential animation everywhere in the app.",
        ),
      ]),
    ]),
  ],
};

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const slug = (v: unknown, p: string) =>
  str(v, 24).replace(/[^\w-]/g, "") || id(p);
const list = (v: unknown, max: number) =>
  (Array.isArray(v) ? v : []).slice(0, max);

/** Rebuilds a saved FAQ, keeping only valid tabs, sections and questions. */
export function cleanFaq(v: unknown): Faq {
  if (!v || typeof v !== "object") return DEFAULT_FAQ;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.tabs)) return DEFAULT_FAQ;
  const seen = new Set<string>();
  const once = (k: string, p: string) => {
    let x = k;
    while (seen.has(x)) x = id(p);
    seen.add(x);
    return x;
  };
  const tabs = list(o.tabs, FAQ_LIMITS.tabs).flatMap((t) => {
    const r = (t ?? {}) as Record<string, unknown>;
    const title = str(r.title, 40);
    if (!title) return [];
    return [
      {
        id: once(slug(r.id, "t"), "t"),
        title,
        sections: list(r.sections, FAQ_LIMITS.sections).flatMap((s) => {
          const x = (s ?? {}) as Record<string, unknown>;
          const name = str(x.title, 80);
          if (!name) return [];
          return [
            {
              id: once(slug(x.id, "s"), "s"),
              title: name,
              items: list(x.items, FAQ_LIMITS.items).flatMap((i) => {
                const y = (i ?? {}) as Record<string, unknown>;
                const q = str(y.q, FAQ_LIMITS.q);
                const a = str(y.a, FAQ_LIMITS.a);
                return q && a ? [{ id: once(slug(y.id, "q"), "q"), q, a }] : [];
              }),
            },
          ];
        }),
      },
    ];
  });
  return { intro: str(o.intro, 300), tabs };
}

/** One answer's paragraphs, each split into text and the links in it. */
export function answerParts(a: string) {
  return a
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const out: ({ text: string } | { text: string; href: string })[] = [];
      const re = /\[([^\]]{1,80})\]\((\/[^)\s]*|https:\/\/[^)\s]+)\)/g;
      let at = 0;
      for (const m of p.matchAll(re)) {
        if (m.index > at) out.push({ text: p.slice(at, m.index) });
        out.push({ text: m[1], href: m[2] });
        at = m.index + m[0].length;
      }
      if (at < p.length) out.push({ text: p.slice(at) });
      return out;
    });
}

export async function getFaq(): Promise<Faq> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return DEFAULT_FAQ;
  try {
    const res = await fetch(
      `${url}/rest/v1/app_config?select=value&key=eq.faq`,
      {
        headers: { apikey: key },
        next: { revalidate: 3600, tags: ["faq"] },
      },
    );
    const rows = res.ok ? ((await res.json()) as { value: unknown }[]) : [];
    return rows.length ? cleanFaq(rows[0].value) : DEFAULT_FAQ;
  } catch {
    return DEFAULT_FAQ;
  }
}
