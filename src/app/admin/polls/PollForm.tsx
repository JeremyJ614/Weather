"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { savePoll } from "./actions";
import s from "./Polls.module.css";

export type AdminPoll = {
  id: string;
  question: string;
  options: string[];
  note: string | null;
  starts_on: string;
};

/** Write or edit a poll and pick its week. */
export function PollForm({ poll, week }: { poll?: AdminPoll; week: string }) {
  const [options, setOptions] = useState(poll?.options ?? ["", ""]);
  const [state, action, pending] = useActionState(savePoll, null);
  return (
    <form action={action} className={s.form}>
      {poll && <input type="hidden" name="id" value={poll.id} />}
      <label className={s.label}>
        Question
        <input
          name="question"
          defaultValue={poll?.question}
          maxLength={200}
          placeholder="What's your favorite kind of storm to watch?"
          required
        />
      </label>
      <fieldset className={s.options}>
        <legend>Options</legend>
        {options.map((o, i) => (
          <div key={i} className={s.optRow}>
            <input
              name="option"
              value={o}
              maxLength={80}
              onChange={(e) =>
                setOptions(
                  options.map((x, k) => (k === i ? e.target.value : x)),
                )
              }
              placeholder={`Option ${i + 1}`}
            />
            {options.length > 2 && (
              <button
                type="button"
                aria-label={`Remove option ${i + 1}`}
                onClick={() => setOptions(options.filter((_, k) => k !== i))}
              >
                <Trash2 aria-hidden />
              </button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <button
            type="button"
            className={s.add}
            onClick={() => setOptions([...options, ""])}
          >
            <Plus aria-hidden /> Add an option
          </button>
        )}
      </fieldset>
      <label className={s.label}>
        Note (optional, shown under the question)
        <input name="note" defaultValue={poll?.note ?? ""} maxLength={300} />
      </label>
      <label className={s.label}>
        Week (any day in it; polls run Monday to Sunday, Eastern)
        <input
          type="date"
          name="week"
          defaultValue={poll?.starts_on ?? week}
          min={week}
          required
        />
      </label>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : poll ? "Save changes" : "Schedule poll"}
      </Button>
      {state && (
        <p className={state.error ? s.err : s.ok} role="status">
          {state.error ?? state.ok}
        </p>
      )}
    </form>
  );
}
