"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { BONUS_POINTS, DEFAULT_POINTS } from "@/lib/trivia/shape";
import { aiDraft, saveQuestion } from "./actions";
import s from "./Trivia.module.css";

export type AdminQ = {
  id: string;
  slot: number;
  category: "weather" | "random";
  question: string;
  choices: string[];
  answer_index: number;
  explanation: string | null;
  points: number;
  bonus: boolean;
  active: boolean;
  source: "ai" | "admin";
};

/** Add or edit one question; any question's points and Bonus flag can be set. */
export function QuestionForm({ day, q }: { day: string; q?: AdminQ }) {
  const [category, setCategory] = useState(q?.category ?? "weather");
  const [question, setQuestion] = useState(q?.question ?? "");
  const [choices, setChoices] = useState(q?.choices ?? ["", "", "", ""]);
  const [answer, setAnswer] = useState(q?.answer_index ?? 0);
  const [explanation, setExplanation] = useState(q?.explanation ?? "");
  const [points, setPoints] = useState(String(q?.points ?? DEFAULT_POINTS));
  const [bonus, setBonus] = useState(q?.bonus ?? false);
  const [active, setActive] = useState(q?.active ?? true);
  const [state, action, pending] = useActionState(saveQuestion, null);
  const [drafting, startDraft] = useTransition();
  const [draftErr, setDraftErr] = useState<string | null>(null);

  const toggleBonus = () => {
    const on = !bonus;
    setBonus(on);
    if (on && Number(points) <= DEFAULT_POINTS) setPoints(String(BONUS_POINTS));
    if (!on && Number(points) === BONUS_POINTS)
      setPoints(String(DEFAULT_POINTS));
  };

  const draft = () =>
    startDraft(async () => {
      setDraftErr(null);
      const d = await aiDraft(category);
      if ("error" in d) return setDraftErr(d.error);
      setQuestion(d.question);
      setChoices(d.choices);
      setAnswer(d.answer_index);
      setExplanation(d.explanation);
    });

  return (
    <form action={action} className={`${s.form} ${bonus ? s.isBonus : ""}`}>
      {q && <input type="hidden" name="id" value={q.id} />}
      <input type="hidden" name="day" value={day} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="answer" value={answer} />
      {bonus && <input type="hidden" name="bonus" value="on" />}
      {!active && <input type="hidden" name="active" value="off" />}

      <div className={s.row}>
        <Chip
          pressed={category === "weather"}
          onClick={() => setCategory("weather")}
        >
          Weather
        </Chip>
        <Chip
          pressed={category === "random"}
          onClick={() => setCategory("random")}
        >
          Wild card
        </Chip>
        {q && (
          <span className={s.src}>
            {q.source === "ai" ? "Written by AI" : "Admin question"}
          </span>
        )}
      </div>

      <label className={s.label}>
        Question
        <textarea
          name="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={300}
          rows={3}
          required
        />
      </label>

      <fieldset className={s.choices}>
        <legend>Choices (tap the circle on the right answer)</legend>
        {choices.map((c, i) => (
          <div key={i} className={s.choiceRow}>
            <button
              type="button"
              className={s.radio}
              aria-pressed={answer === i}
              aria-label={`Mark choice ${i + 1} correct`}
              onClick={() => setAnswer(i)}
            />
            <input
              name="choice"
              value={c}
              maxLength={120}
              onChange={(e) =>
                setChoices(
                  choices.map((x, k) => (k === i ? e.target.value : x)),
                )
              }
              placeholder={`Choice ${i + 1}`}
            />
            {choices.length > 2 && (
              <button
                type="button"
                className={s.icon}
                aria-label={`Remove choice ${i + 1}`}
                onClick={() => {
                  setChoices(choices.filter((_, k) => k !== i));
                  if (answer >= i && answer > 0) setAnswer(answer - 1);
                }}
              >
                <Trash2 aria-hidden />
              </button>
            )}
          </div>
        ))}
        {choices.length < 6 && (
          <button
            type="button"
            className={s.add}
            onClick={() => setChoices([...choices, ""])}
          >
            <Plus aria-hidden /> Add a choice
          </button>
        )}
      </fieldset>

      <label className={s.label}>
        Why (shown after answering)
        <textarea
          name="explanation"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          maxLength={600}
          rows={2}
        />
      </label>

      <div className={`${s.row} ${s.pointsRow}`}>
        <label className={`${s.label} ${s.points}`}>
          Points
          <input
            name="points"
            inputMode="numeric"
            value={points}
            onChange={(e) => setPoints(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        <Chip pressed={bonus} onClick={toggleBonus}>
          <Sparkles className="mr-1 inline size-3.5" aria-hidden /> Bonus
          question
        </Chip>
        <Chip pressed={!active} onClick={() => setActive(!active)}>
          Hidden
        </Chip>
      </div>

      <div className={s.row}>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : q ? "Save changes" : "Add question"}
        </Button>
        {!q && (
          <Button type="button" onClick={draft} disabled={drafting}>
            <Wand2 className="size-4" aria-hidden />{" "}
            {drafting ? "Writing…" : "Write with AI"}
          </Button>
        )}
      </div>
      {(state || draftErr) && (
        <p className={state?.error || draftErr ? s.err : s.ok} role="status">
          {draftErr ?? state?.error ?? state?.ok}
        </p>
      )}
    </form>
  );
}
