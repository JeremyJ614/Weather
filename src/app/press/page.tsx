import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/ui/PageHero";
import { pageMeta, SITE } from "@/lib/seo/site";
import { EVERY_PAGE } from "@/lib/nav/extras";
import { EXTRAS_ITEMS } from "@/lib/extras/items";
import s from "../reports/Report.module.css";

export const metadata: Metadata = pageMeta(
  "/press",
  "Press",
  "Press kit, story ideas, free maps and data, and expert sources on severe weather and storm chasing from StormSync Media.",
);

/**
 * Press (post-launch A9 "press", B8): what reporters need in one place: who we are, the facts,
 * free maps, widgets and data they may use with credit, and how to reach us for comment.
 */
export default function Press() {
  const engines = EXTRAS_ITEMS.filter((i) => i.group === "engines").length;
  const boiler = `${SITE.name} (${SITE.url.replace("https://", "")}) is a membership severe weather app from ${SITE.publisher} (SSWX), a storm chasing, meteorology and forecasting team. It brings live radar, Storm Prediction Center outlooks, warnings, a Tornado Archive with 3D replays and ${engines} experimental weather engines together in one phone-first app.`;
  return (
    <main className="grid gap-4 pb-10">
      <PageHero
        eyebrow={["Press", SITE.publisher]}
        title="Press and media"
        subtitle="Covering severe weather? Use our maps and data, or ask our team for comment."
      />
      <section className={s.stats}>
        <div>
          <b>{EVERY_PAGE.length}</b>
          <span>live pages and tools</span>
        </div>
        <div>
          <b>{engines}</b>
          <span>weather engines of our own</span>
        </div>
        <div>
          <b>Since 1950</b>
          <span>every U.S. tornado in our climatology and archive</span>
        </div>
        <div>
          <b>54</b>
          <span>historic tornado days replayed in 3D</span>
        </div>
      </section>
      <section className={s.card}>
        <h2>About us (boilerplate)</h2>
        <p className={s.cite}>{boiler}</p>
      </section>
      <section className={s.card}>
        <h2>Free to use with credit</h2>
        <ul className={s.days}>
          <li>
            <b>
              <Link href="/reports">Data reports</Link>
            </b>
            <span>
              Chart-led reports made to be cited, like the 2026 tornado season
              in numbers.
            </span>
          </li>
          <li>
            <b>
              <Link href="/widgets">Embeddable widgets</Link>
            </b>
            <span>
              The live SSWXCon Score, today&apos;s SPC risk, radar and local
              conditions for any website.
            </span>
          </li>
          <li>
            <b>
              <Link href="/web-stories">Web Stories</Link>
            </b>
            <span>
              One-minute stories of famous tornadoes and today&apos;s biggest
              storms.
            </span>
          </li>
          <li>
            <b>
              <Link href="/sswxcon">SSWXCon Score</Link>
            </b>
            <span>
              One number for how stormy the country is right now (0 to 250).
            </span>
          </li>
        </ul>
        <p className={s.note}>
          Credit &quot;{SITE.name}&quot; with a link to {SITE.url}. Maps built
          on NOAA data are public domain at the source.
        </p>
      </section>
      <section className={s.card}>
        <h2>Story ideas</h2>
        <ul className={s.days}>
          <li>
            <b>Before a big severe day</b>
            <span>
              Where storms are most likely, when, and what the SSWXCon Score
              says.
            </span>
          </li>
          <li>
            <b>Anniversaries</b>
            <span>
              Tornado Archive replays of famous events, minute by minute.
            </span>
          </li>
          <li>
            <b>Storm chasing</b>
            <span>
              How chasers pick a target, stay safe and report what they see.
            </span>
          </li>
          <li>
            <b>Radar blind spots</b>
            <span>
              Which towns sit where radar can miss a tornado near the ground.
            </span>
          </li>
        </ul>
      </section>
      <section className={s.card}>
        <h2>Ask for comment</h2>
        <p className={s.note}>
          Our storm chasers and forecasters can comment on severe weather,
          tornadoes, hurricanes and storm safety. Reach us through the contact
          page; mention your outlet and deadline.
        </p>
        <Link href="/contact" className={s.cite}>
          Contact the team
        </Link>
      </section>
    </main>
  );
}
