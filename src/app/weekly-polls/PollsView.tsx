"use client";

import { useState, useTransition } from "react";
import { Check, Crown, Users } from "lucide-react";
import { vote } from "./actions";
import s from "./Polls.module.css";

export type Poll = {
  id: string;
  question: string;
  options: string[];
  note: string | null;
  starts_on: string;
  ends_on: string;
  open: boolean;
  my_choice: number | null;
  tallies: number[] | null;
  total: number | null;
};

const span = (a: string, b: string) => {
  const f = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return `${f(a)} – ${f(b)}`;
};

function Results({ poll, fresh }: { poll: Poll; fresh?: boolean }) {
  const tallies = poll.tallies ?? [];
  const total = poll.total ?? 0;
  const top = Math.max(0, ...tallies);
  return (
    <ol className={`${s.results} ${fresh ? s.fresh : ""}`}>
      {poll.options.map((o, i) => {
        const n = tallies[i] ?? 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        const lead = total > 0 && n === top;
        return (
          <li
            key={i}
            className={lead ? s.lead : undefined}
            style={{ ["--i" as string]: i }}
          >
            <span
              className={s.bar}
              style={{ transform: `scaleX(${total ? n / total : 0})` }}
              aria-hidden
            />
            <span className={s.label}>
              {lead && <Crown aria-hidden />}
              {o}
              {poll.my_choice === i && (
                <span className={s.mine}>
                  <Check aria-hidden /> You
                </span>
              )}
            </span>
            <b>{pct}%</b>
          </li>
        );
      })}
    </ol>
  );
}

function OpenPoll({ poll: initial }: { poll: Poll }) {
  const [poll, setPoll] = useState(initial);
  const [fresh, setFresh] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<number | null>(null);
  const voted = poll.my_choice !== null && poll.tallies !== null;

  const cast = (i: number) =>
    start(async () => {
      setPicked(i);
      setErr(null);
      const r = await vote(poll.id, i);
      if ("error" in r) {
        setErr(r.error);
        setPicked(null);
        return;
      }
      setPoll(r);
      setFresh(true);
    });

  return (
    <article className={s.card}>
      <header className={s.head}>
        <span className={s.live}>
          <i aria-hidden /> Open this week
        </span>
        <span className={s.dates}>{span(poll.starts_on, poll.ends_on)}</span>
      </header>
      <h2 className={s.q}>{poll.question}</h2>
      {poll.note && <p className={s.note}>{poll.note}</p>}
      {voted ? (
        <>
          <Results poll={poll} fresh={fresh} />
          <p className={s.total}>
            <Users aria-hidden /> {(poll.total ?? 0).toLocaleString()}{" "}
            {poll.total === 1 ? "vote" : "votes"} so far
          </p>
        </>
      ) : (
        <>
          <ol className={s.options}>
            {poll.options.map((o, i) => (
              <li key={i}>
                <button
                  className={s.option}
                  data-picked={picked === i}
                  disabled={pending}
                  onClick={() => cast(i)}
                  style={{ ["--i" as string]: i }}
                >
                  <span className={s.dot} aria-hidden />
                  {o}
                </button>
              </li>
            ))}
          </ol>
          <p className={s.hint}>Vote to see how everyone else voted.</p>
        </>
      )}
      {err && <p className={s.err}>{err}</p>}
    </article>
  );
}

/** This week's poll(s) to vote on. */
export function ThisWeek({ polls }: { polls: Poll[] }) {
  const open = polls.filter((p) => p.open);
  if (!open.length)
    return (
      <p className={s.empty}>
        No poll is open this week. A new one opens on Monday.
      </p>
    );
  return (
    <div className="grid gap-4">
      {open.map((p) => (
        <OpenPoll key={p.id} poll={p} />
      ))}
    </div>
  );
}

/** Closed polls with their final results. */
export function PastPolls({ polls }: { polls: Poll[] }) {
  const past = polls.filter((p) => !p.open);
  if (!past.length)
    return <p className={s.empty}>Closed polls and their results land here.</p>;
  return (
    <div className="grid gap-4">
      {past.map((p) => (
        <article key={p.id} className={`${s.card} ${s.past}`}>
          <header className={s.head}>
            <span className={s.dates}>{span(p.starts_on, p.ends_on)}</span>
            <span className={s.dates}>
              {(p.total ?? 0).toLocaleString()} votes
            </span>
          </header>
          <h3 className={s.q}>{p.question}</h3>
          <Results poll={p} />
        </article>
      ))}
    </div>
  );
}
