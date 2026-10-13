"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Check,
  CloudLightning,
  Shuffle,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { answerTrivia, type Graded } from "./trivia-actions";
import s from "./Trivia.module.css";

export type TriviaQ = {
  id: string;
  slot: number;
  category: "weather" | "random";
  question: string;
  choices: string[];
  points: number;
  bonus: boolean;
  answered: boolean;
  choice_index: number | null;
  correct: boolean | null;
  earned: number | null;
  answer_index: number | null;
  explanation: string | null;
};

const LETTERS = "ABCDEF";

function Card({
  q,
  index,
  onGraded,
}: {
  q: TriviaQ;
  index: number;
  onGraded: (earned: number) => void;
}) {
  const [res, setRes] = useState<(Graded & { pick: number }) | null>(
    q.answered
      ? {
          pick: q.choice_index ?? -1,
          correct: !!q.correct,
          earned: q.earned ?? 0,
          answer_index: q.answer_index ?? -1,
          explanation: q.explanation,
        }
      : null,
  );
  const [fresh, setFresh] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<number | null>(null);

  const choose = (i: number) =>
    start(async () => {
      setPicked(i);
      setErr(null);
      const r = await answerTrivia(q.id, i);
      if ("error" in r) {
        setErr(r.error);
        setPicked(null);
        return;
      }
      setRes({ ...r, pick: i });
      setFresh(true);
      onGraded(r.earned);
    });

  return (
    <article
      className={`${s.card} ${q.bonus ? s.bonus : ""}`}
      style={{ ["--d" as string]: index }}
    >
      {q.bonus && (
        <>
          <span className={s.halo} aria-hidden />
          <span className={s.clip} aria-hidden>
            <span className={s.rim} />
          </span>
          <span className={s.stars} aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <Star key={k} style={{ ["--k" as string]: k }} />
            ))}
          </span>
        </>
      )}
      <div className={s.inner}>
        <header className={s.head}>
          {q.bonus ? (
            <span className={s.bonusTag}>
              <Sparkles aria-hidden /> Bonus question
            </span>
          ) : (
            <span className={s.cat}>
              {q.category === "weather" ? (
                <CloudLightning aria-hidden />
              ) : (
                <Shuffle aria-hidden />
              )}
              {q.category === "weather" ? "Weather" : "Wild card"}
            </span>
          )}
          <span className={s.pts}>{q.points.toLocaleString()} pts</span>
        </header>
        <h3 className={s.q}>{q.question}</h3>
        <ol className={s.choices}>
          {q.choices.map((c, i) => {
            const state = !res
              ? picked === i
                ? "picked"
                : undefined
              : i === res.answer_index
                ? "right"
                : i === res.pick
                  ? "wrong"
                  : "dim";
            return (
              <li key={i}>
                <button
                  className={s.choice}
                  data-state={state}
                  disabled={!!res || pending}
                  onClick={() => choose(i)}
                >
                  <span className={s.letter}>{LETTERS[i]}</span>
                  <span>{c}</span>
                  {state === "right" && <Check aria-hidden />}
                  {state === "wrong" && <X aria-hidden />}
                </button>
              </li>
            );
          })}
        </ol>
        {err && <p className={s.err}>{err}</p>}
        {res && (
          <div className={s.verdict} data-correct={res.correct}>
            <p className={s.result}>
              {res.correct ? "Correct!" : "Not quite."}
              {res.correct && (
                <b className={fresh ? s.pop : undefined}>
                  +{res.earned.toLocaleString()}
                </b>
              )}
            </p>
            {res.explanation && <p className={s.why}>{res.explanation}</p>}
          </div>
        )}
      </div>
    </article>
  );
}

/** Daily Trivia: today's questions, graded by the database, one try each. */
export function TriviaView({
  signedIn,
  questions,
}: {
  signedIn: boolean;
  questions: TriviaQ[];
}) {
  const [got, setGot] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      questions.filter((q) => q.answered).map((q) => [q.id, q.earned ?? 0]),
    ),
  );
  if (!signedIn)
    return (
      <section className={s.signin}>
        <p>Sign in to answer today&apos;s questions and earn points.</p>
        <Link href="/login?next=/wx-games">
          <Button variant="primary">Sign in to play</Button>
        </Link>
      </section>
    );
  if (!questions.length)
    return (
      <p className={s.empty}>
        Today&apos;s questions are being written. Check back in a minute.
      </p>
    );
  const total = questions.reduce((a, q) => a + q.points, 0);
  const done = Object.keys(got).length;
  const earned = Object.values(got).reduce((a, n) => a + n, 0);
  return (
    <div className="grid gap-4">
      <section className={s.meter}>
        <div>
          <p className="eyebrow">Today&apos;s trivia</p>
          <p className={s.meterLine}>
            {done} of {questions.length} answered
          </p>
        </div>
        <div className={s.meterPts}>
          <b>{earned.toLocaleString()}</b>
          <span>of {total.toLocaleString()} pts</span>
        </div>
      </section>
      {questions.map((q, i) => (
        <Card
          key={q.id}
          q={q}
          index={i}
          onGraded={(n) => setGot((g) => ({ ...g, [q.id]: n }))}
        />
      ))}
      <p className={s.fine}>
        One try per question. Points go straight to the Leaderboard. New
        questions arrive at midnight Eastern.
      </p>
    </div>
  );
}
