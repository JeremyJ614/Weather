"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Award,
  Copy,
  Crown,
  Flame,
  MapPin,
  Pencil,
  Star,
  Trophy,
  Vote,
  Bell,
  LogOut,
  Settings,
} from "lucide-react";
import { BadgeEmblem, BadgePlate } from "@/components/BadgeIcon";
import { usePlaces } from "@/features/location/usePlaces";
import { setActive, write } from "@/features/location/store";
import type { Colors } from "@/lib/colors/pick";
import { progressText, type Badge } from "@/lib/badges";
import s from "./Profile.module.css";

// The edit form loads when Edit is pressed (review round, speed pick "split-heavy").
const EditForm = dynamic(() => import("./EditForm").then((m) => m.EditForm));

export type ProfileData = {
  name: string;
  first: string;
  last: string;
  nickname: string;
  useNickname: boolean;
  city: string;
  state: string;
  phone: string;
  since: string | null;
  code: number | null;
  referred: number;
  roles: string[];
  tier: string;
  cycle: string | null;
  points: { total: number; game: number; trivia: number; month: number };
  guesses: number;
  trivia: { answered: number; correct: number };
  votes: number;
  streak: number;
  bestStreak: number;
  badges: (Badge & { at: string })[];
  badgeTotal: number;
  /** Badges given on this visit. */
  fresh: string[];
  /** Automatic badges not earned yet, closest to done first. */
  toEarn: (Badge & { value: number; goal: number })[];
  titles: {
    kind: string;
    period: string;
    name: string | null;
    points: number | null;
  }[];
};

const fmt = (n: number) => n.toLocaleString("en-US");
const monthName = (p: string) =>
  p.length === 4
    ? p
    : new Date(`${p}-15T12:00:00Z`).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });

/** My Profile: identity, plan, play stats, badges, titles, places and referrals. */
export function ProfileView({
  data: d,
  colors,
}: {
  data: ProfileData;
  colors: Colors;
}) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { places, active } = usePlaces();
  const initials = d.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const acc = d.trivia.answered
    ? Math.round((d.trivia.correct / d.trivia.answered) * 100)
    : 0;
  return (
    <div className="grid gap-4">
      <section className={s.head}>
        <div className={s.avatar} aria-hidden>
          {initials}
        </div>
        <div className={s.who}>
          <h1>{d.name}</h1>
          <p>
            {d.city && `${d.city}, ${d.state} · `}
            Member since{" "}
            {d.since
              ? new Date(d.since).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })
              : "–"}
          </p>
          <div className={s.tags}>
            <span data-tier>
              <Crown aria-hidden /> {d.tier}
              {d.cycle && d.tier !== "Free" ? ` · ${d.cycle}ly` : ""}
            </span>
            {d.roles.includes("founder") && <span>Founder</span>}
            {!d.roles.includes("founder") && d.roles.includes("admin") && (
              <span>Admin</span>
            )}
          </div>
        </div>
        <button
          type="button"
          className={s.edit}
          aria-label="Edit profile"
          aria-expanded={editing}
          onClick={() => setEditing(!editing)}
        >
          <Pencil aria-hidden />
        </button>
      </section>

      {editing && <EditForm d={d} onDone={() => setEditing(false)} />}

      <section className={s.stats}>
        <div data-big>
          <Star aria-hidden />
          <b>{fmt(d.points.total)}</b>
          <small>total points</small>
        </div>
        <div>
          <b>{fmt(d.points.month)}</b>
          <small>this month</small>
        </div>
        <div>
          <Flame aria-hidden />
          <b>{d.streak}</b>
          <small>day streak · best {d.bestStreak}</small>
        </div>
        <div>
          <b>{fmt(d.guesses)}</b>
          <small>forecast guesses · {fmt(d.points.game)} pts</small>
        </div>
        <div>
          <b>{d.trivia.answered ? `${acc}%` : "–"}</b>
          <small>
            trivia right ({d.trivia.correct}/{d.trivia.answered}) ·{" "}
            {fmt(d.points.trivia)} pts
          </small>
        </div>
        <div>
          <Vote aria-hidden />
          <b>{fmt(d.votes)}</b>
          <small>poll votes</small>
        </div>
      </section>

      <section className={s.card}>
        <header>
          <Award aria-hidden />
          <h2>Badges</h2>
          <small>
            {d.badges.length} of {d.badgeTotal}
          </small>
        </header>
        {d.badges.length ? (
          <ul className={s.badges}>
            {d.badges.map((b) => (
              <li key={b.id} data-new={d.fresh.includes(b.id) || undefined}>
                {d.fresh.includes(b.id) && <i className={s.newTag}>New</i>}
                <BadgePlate badge={b} colors={colors} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.muted}>
            No badges yet. Play the forecast game, answer trivia and vote in
            polls to start earning them.
          </p>
        )}
        {d.toEarn.length > 0 && (
          <>
            <h3 className={s.subhead}>Up next</h3>
            <ul className={s.toEarn}>
              {(showAll ? d.toEarn : d.toEarn.slice(0, 5)).map((b) => {
                const pct = Math.min(1, b.value / b.goal);
                const txt = progressText(b.rule_metric!, b.value, b.goal);
                return (
                  <li key={b.id}>
                    <BadgeEmblem badge={b} colors={colors} size={40} dim />
                    <span>
                      <b>{b.name}</b>
                      <small>{b.description}</small>
                      {txt && (
                        <span className={s.bar} aria-label={txt}>
                          <i style={{ transform: `scaleX(${pct})` }} />
                        </span>
                      )}
                      {txt && <small>{txt}</small>}
                    </span>
                    <em data-r={b.rarity}>{b.rarity}</em>
                  </li>
                );
              })}
            </ul>
            {d.toEarn.length > 5 && (
              <button
                type="button"
                className={s.more}
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll
                  ? "Show fewer"
                  : `Show all ${d.toEarn.length} badges to earn`}
              </button>
            )}
          </>
        )}
      </section>

      <section className={s.card}>
        <header>
          <Trophy aria-hidden />
          <h2>Leaderboard history</h2>
        </header>
        {d.titles.length ? (
          <ul className={s.titles}>
            {d.titles.map((t) => (
              <li key={`${t.kind}${t.period}`}>
                <Trophy aria-hidden />
                <span>
                  <b>
                    {t.name ??
                      (t.kind === "year"
                        ? "Champion of the year"
                        : "Champion of the month")}
                  </b>
                  <small>
                    {monthName(t.period)}
                    {t.points != null ? ` · ${fmt(t.points)} points` : ""}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.muted}>
            No titles yet. The top scorer each month and each year earns one;{" "}
            <Link href="/leaderboard">see the leaderboard</Link>.
          </p>
        )}
      </section>

      <section className={s.card}>
        <header>
          <MapPin aria-hidden />
          <h2>Saved places</h2>
          <small>{places.list.length} of 5</small>
        </header>
        {places.list.length ? (
          <ul className={s.places}>
            {places.list.map((pl) => (
              <li key={pl.id} data-active={pl.id === active?.id || undefined}>
                <span>
                  <b>{pl.label}</b>
                  <small>
                    {pl.id === active?.id
                      ? "Your weather is for here"
                      : "Saved"}
                  </small>
                </span>
                {pl.id !== active?.id && (
                  <button
                    type="button"
                    onClick={() => write(setActive(places, pl.id))}
                  >
                    Use
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.muted}>
            No places yet. Add one from the Homepage and every page tailors
            itself to it.
          </p>
        )}
        <p className={s.small}>Saved on this device.</p>
      </section>

      {d.code != null && (
        <section className={s.card}>
          <header>
            <Star aria-hidden />
            <h2>Referrals</h2>
            <small>{d.referred} joined with your code</small>
          </header>
          <div className={s.code}>
            <b>{String(d.code).padStart(6, "0")}</b>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(String(d.code).padStart(6, "0"))
                  .then(() => setCopied(true))
                  .catch(() => {});
              }}
            >
              <Copy aria-hidden /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className={s.muted}>
            Friends enter this code when they sign up, and it counts toward your
            referral rewards.
          </p>
        </section>
      )}

      <nav className={s.links} aria-label="Your account">
        <Link href="/settings">
          <Settings aria-hidden /> Account Settings
        </Link>
        <Link href="/notifications">
          <Bell aria-hidden /> Notifications
        </Link>
        <Link href="/settings#plan-h">
          <Crown aria-hidden /> Plan &amp; billing
        </Link>
        <form action="/auth/signout" method="post">
          <button type="submit">
            <LogOut aria-hidden /> Sign out
          </button>
        </form>
      </nav>
    </div>
  );
}
