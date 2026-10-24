"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { Delete, Lightbulb, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { pick, type Colors } from "@/lib/colors/pick";
import { MARK, WORDLE_COLORS, type MarkKey } from "@/lib/weatherdle/colors";
import { wdGuess, wdHint, wdState } from "./weatherdle-actions";
import s from "./Weatherdle.module.css";

export type WdState = {
  day: string;
  /** Letters in today's word; null while it is still being picked. */
  length: number | null;
  tries?: number;
  hints: boolean;
  hint?: string | null;
  hint_used?: boolean;
  guesses?: { word: string; marks: string }[];
  solved?: boolean;
  done?: boolean;
  points?: number;
  word?: string | null;
};

export type WdStats = { played: number; solved: number; streak: number };

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const RANK: Record<MarkKey, number> = { miss: 1, near: 2, hit: 3 };
const EMOJI: Record<MarkKey, string> = { hit: "🟩", near: "🟨", miss: "⬛" };

const tileColors = (colors: Colors) =>
  Object.fromEntries(
    WORDLE_COLORS.map((c) => [
      c.key,
      pick(colors, `weatherdle:${c.key}`, c.color),
    ]),
  ) as Record<MarkKey, string>;

/**
 * The board: every guess graded, the row being typed, and empty rows to go. Exported for
 * the admin color preview, which shows an example game in the colors being edited.
 */
export function Board({
  length,
  guesses,
  typing = "",
  colors,
  reveal = -1,
  shake = false,
  tries = 6,
}: {
  length: number;
  guesses: { word: string; marks: string }[];
  typing?: string;
  colors: Colors;
  /** Index of the row that just came back, which flips in. */
  reveal?: number;
  shake?: boolean;
  tries?: number;
}) {
  const c = tileColors(colors);
  return (
    <div
      className={s.board}
      style={{ "--n": length } as React.CSSProperties}
      aria-label={`${guesses.length} of ${tries} guesses used`}
    >
      {Array.from({ length: tries }, (_, r) => {
        const g = guesses[r];
        const current = !g && r === guesses.length;
        return (
          <div
            key={r}
            className={`${s.row} ${current && shake ? s.shake : ""}`}
            role="group"
            aria-label={g ? `${g.word}: guess ${r + 1}` : `Row ${r + 1}`}
          >
            {Array.from({ length }, (_, i) => {
              const ch = g ? g.word[i] : current ? (typing[i] ?? "") : "";
              const m = g ? MARK[g.marks[i]] : null;
              return (
                <span
                  key={i}
                  className={`${s.tile} ${m ? s.done : ch ? s.typed : ""} ${r === reveal ? s.flip : ""}`}
                  style={
                    m
                      ? ({
                          background: c[m],
                          borderColor: c[m],
                          animationDelay: `${i * 110}ms`,
                        } as React.CSSProperties)
                      : undefined
                  }
                  aria-label={
                    m
                      ? `${ch}, ${m === "hit" ? "right spot" : m === "near" ? "in the word" : "not in the word"}`
                      : undefined
                  }
                >
                  {ch}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Weatherdle: today's weather word, any length, six tries, graded by the database. */
export function WeatherdleView({
  signedIn,
  lens,
  initial,
  stats,
  colors,
}: {
  signedIn: boolean;
  lens: boolean;
  initial: WdState | null;
  stats: WdStats | null;
  colors: Colors;
}) {
  const [st, setSt] = useState(initial);
  const [cur, setCur] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [reveal, setReveal] = useState(-1);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const n = st?.length ?? 0;
  const guesses = useMemo(() => st?.guesses ?? [], [st]);
  const done = Boolean(st?.done);
  const c = tileColors(colors);

  const keys = useMemo(() => {
    const k: Record<string, MarkKey> = {};
    for (const g of guesses)
      [...g.word].forEach((ch, i) => {
        const m = MARK[g.marks[i]];
        if (!k[ch] || RANK[m] > RANK[k[ch]]) k[ch] = m;
      });
    return k;
  }, [guesses]);

  const nope = (text: string) => {
    setMsg(text);
    setShake(true);
    setTimeout(() => setShake(false), 450);
  };

  const submit = useCallback(() => {
    if (pending || done || !n) return;
    if (cur.length < n) return nope(`Use all ${n} letters.`);
    start(async () => {
      const r = await wdGuess(cur);
      if ("error" in r) return nope(r.error);
      setMsg(null);
      setCur("");
      setReveal((r.state.guesses?.length ?? 1) - 1);
      setSt(r.state);
    });
  }, [pending, done, n, cur]);

  const press = useCallback(
    (k: string) => {
      if (done || !n) return;
      if (k === "ENTER") return submit();
      if (k === "BACK") return setCur((x) => x.slice(0, -1));
      if (/^[A-Z]$/.test(k)) setCur((x) => (x.length < n ? x + k : x));
    },
    [done, n, submit],
  );

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "Enter") press("ENTER");
      else if (e.key === "Backspace") press("BACK");
      else if (/^[a-z]$/i.test(e.key)) press(e.key.toUpperCase());
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [press]);

  if (!signedIn)
    return (
      <section className={s.signin}>
        <p>
          Sign in to play Weatherdle: a new weather word every day, any length,
          six tries. Every solve counts toward the Leaderboard.
        </p>
        <Link href="/login?next=/wx-games">
          <Button variant="primary">Sign in to play</Button>
        </Link>
      </section>
    );
  if (lens)
    return (
      <p className={s.note}>
        Weatherdle is played by members themselves; View as can&apos;t play it
        for them.
      </p>
    );
  if (!st?.length)
    return (
      <div className={s.note}>
        <p>
          Today&apos;s word is being picked. It&apos;ll be ready in a minute.
        </p>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await wdState();
              if ("state" in r) setSt(r.state);
            })
          }
        >
          Check again
        </Button>
      </div>
    );

  const day = new Date(`${st.day}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const share = async () => {
    const lines = guesses.map((g) =>
      [...g.marks].map((m) => EMOJI[MARK[m]]).join(""),
    );
    const text = `Weatherdle ${day} · ${st.solved ? guesses.length : "X"}/${st.tries ?? 6}${st.hint_used ? " · hint" : ""}\n${lines.join("\n")}\nweather.sswx.space/wx-games`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // The share sheet was closed.
    }
  };

  return (
    <div className="grid gap-4">
      <section className={s.head}>
        <div>
          <p className="eyebrow">Weatherdle · {day}</p>
          <p className={s.headLine}>
            A {n}-letter weather word,{" "}
            {done
              ? st.solved
                ? `solved in ${guesses.length}`
                : "out of tries"
              : `${(st.tries ?? 6) - guesses.length} tries left`}
          </p>
        </div>
        {stats && (
          <dl className={s.stats}>
            <div>
              <dt>Played</dt>
              <dd>{stats.played}</dd>
            </div>
            <div>
              <dt>Solved</dt>
              <dd>{stats.solved}</dd>
            </div>
            <div>
              <dt>Streak</dt>
              <dd>{stats.streak}</dd>
            </div>
          </dl>
        )}
      </section>

      {st.hints && !done && !st.hint_used && (
        <button
          type="button"
          className={s.hintBtn}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await wdHint();
              if ("error" in r) setMsg(r.error);
              else setSt(r.state);
            })
          }
        >
          <Lightbulb aria-hidden /> Need a hint? It takes a quarter off your
          points.
        </button>
      )}
      {st.hint && !done && (
        <p className={s.hint}>
          <Lightbulb aria-hidden /> {st.hint}
        </p>
      )}

      <Board
        length={n}
        guesses={guesses}
        typing={cur}
        colors={colors}
        reveal={reveal}
        shake={shake}
        tries={st.tries ?? 6}
      />
      <p className={s.msg} aria-live="polite">
        {msg ?? (pending ? "Checking…" : "")}
      </p>

      {done ? (
        <section className={s.result}>
          <p className="eyebrow">{st.solved ? "Solved" : "Today's word"}</p>
          <p className={s.word}>{st.word}</p>
          {st.hint && <p className={s.about}>{st.hint}</p>}
          <p className={s.score}>
            {st.solved
              ? `${guesses.length}/${st.tries ?? 6}${st.hint_used ? " with the hint" : ""} · +${(st.points ?? 0).toLocaleString()} points`
              : "Not this time. A new word arrives at midnight Eastern."}
          </p>
          <Button variant="primary" onClick={share}>
            <Share2 className="size-4" aria-hidden />{" "}
            {copied ? "Copied" : "Share your grid"}
          </Button>
        </section>
      ) : (
        <div className={s.keyboard} aria-label="Keyboard">
          {ROWS.map((row, r) => (
            <div key={row} className={s.keyRow}>
              {r === 2 && (
                <button
                  type="button"
                  className={`${s.key} ${s.wide}`}
                  onClick={() => press("ENTER")}
                  disabled={pending}
                >
                  Enter
                </button>
              )}
              {[...row].map((k) => (
                <button
                  key={k}
                  type="button"
                  className={s.key}
                  style={
                    keys[k]
                      ? { background: c[keys[k]], borderColor: c[keys[k]] }
                      : undefined
                  }
                  onClick={() => press(k)}
                >
                  {k}
                </button>
              ))}
              {r === 2 && (
                <button
                  type="button"
                  className={`${s.key} ${s.wide}`}
                  onClick={() => press("BACK")}
                  aria-label="Delete a letter"
                >
                  <Delete className="size-5" aria-hidden />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <p className={s.fine}>
        Any letters count as a guess. 300 points on the first try down to 100 on
        the sixth, 10 more for each letter past five; the hint takes a quarter
        off. Solves count toward the Leaderboard with the Forecast Game and
        Daily Trivia.
      </p>
    </div>
  );
}
