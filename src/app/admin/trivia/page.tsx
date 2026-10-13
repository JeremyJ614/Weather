import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { gameDate } from "@/lib/game/score";
import { removeQuestion } from "./actions";
import { QuestionForm, type AdminQ } from "./QuestionForm";
import s from "./Trivia.module.css";

export const metadata: Metadata = {
  title: "Trivia · Admin · StormSync Media",
};

const shift = (day: string, n: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);

/** Every question for one day: edit AI or admin questions, set points, mark a Bonus Question. */
export default async function TriviaAdmin({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { supabase } = await requireAdmin("trivia");
  const today = gameDate();
  const want = (await searchParams).day ?? "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(want) ? want : today;
  const { data } = await supabase
    .from("trivia_questions")
    .select(
      "id, slot, category, question, choices, answer_index, explanation, points, bonus, active, source",
    )
    .eq("ask_date", day)
    .order("slot");
  const list = (data ?? []) as AdminQ[];
  const label = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 pt-6 pb-24">
      <section className="grid gap-2">
        <h1 className="display text-3xl text-accent">Daily Trivia</h1>
        <p className="text-sm text-muted">
          Gemini writes three questions each midnight (Eastern), two weather and
          one wild card, at 150 points each, never repeating the past year. Edit
          any of them, add your own, set any question&apos;s points, or make one
          the Bonus Question.
        </p>
      </section>

      <nav className={s.days} aria-label="Day">
        <Link
          href={`/admin/trivia?day=${shift(day, -1)}`}
          aria-label="Day before"
        >
          <ChevronLeft aria-hidden />
        </Link>
        <div>
          <b>{label}</b>
          <span>
            {day === today ? "Today" : day < today ? "Past" : "Upcoming"}
          </span>
        </div>
        <Link
          href={`/admin/trivia?day=${shift(day, 1)}`}
          aria-label="Day after"
        >
          <ChevronRight aria-hidden />
        </Link>
      </nav>

      {list.length === 0 && (
        <p className="text-sm text-muted">
          {day > today
            ? "No questions yet. Gemini writes slots 1–3 at midnight; anything you add here appears alongside them."
            : "No questions on this day."}
        </p>
      )}
      {list.map((q) => (
        <details key={q.id} className={s.item}>
          <summary>
            <span className={s.slot}>#{q.slot}</span>
            <span className={s.sumQ}>{q.question}</span>
            {q.bonus && <Sparkles className={s.spark} aria-label="Bonus" />}
            <span className={s.sumPts}>{q.points}</span>
          </summary>
          <QuestionForm day={day} q={q} />
          <form action={removeQuestion} className={s.remove}>
            <input type="hidden" name="id" value={q.id} />
            <button type="submit">Delete this question</button>
          </form>
        </details>
      ))}

      <section className="grid gap-3">
        <h2 className="display text-xl">Add a question for {label}</h2>
        <QuestionForm day={day} />
      </section>
    </main>
  );
}
