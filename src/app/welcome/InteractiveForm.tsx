"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ArrowLeft, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { STATES, age } from "@/lib/auth/signup";
import type { Question, SignupForm } from "@/lib/auth/signup-form";
import { createProfile } from "../login/actions";
import s from "./Interactive.module.css";

type Vals = Record<string, string | string[]>;
const str = (v: Vals, k: string) =>
  typeof v[k] === "string" ? (v[k] as string).trim() : "";
const list = (v: Vals, k: string) =>
  Array.isArray(v[k]) ? (v[k] as string[]) : [];

/** The first problem with one step's answers, or null. Mirrors the server's checks. */
function problem(q: Question, v: Vals): string | null {
  const need = (x: string) =>
    q.required && !x ? `Answer “${q.label}”.` : null;
  switch (q.builtin) {
    case "name":
      return !str(v, "firstName")
        ? "Enter your first name."
        : !str(v, "lastName")
          ? "Enter your last name."
          : null;
    case "nickname":
      return v.useNickname === "on" && !str(v, "nickname")
        ? "Add a nickname or untick “use it as my name”."
        : need(str(v, "nickname"));
    case "location":
      return !str(v, "city")
        ? "Enter your city."
        : !STATES.includes(str(v, "state"))
          ? "Pick your state."
          : null;
    case "birthday": {
      const b = str(v, "birthday");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b)) return "Enter your birthday.";
      return age(b) < 18 ? "You must be 18 or older to join." : null;
    }
    case "phone": {
      const p = str(v, "phone").replace(/[\s().-]/g, "");
      return p && !/^\+?[0-9]{10,15}$/.test(p)
        ? "Enter a 10-digit phone number."
        : need(p);
    }
    case "foundUs":
      return need(str(v, "foundUs"));
    case "referral": {
      const r = str(v, "referral");
      return r && !/^\d{6}$/.test(r) ? "Referral codes are 6 digits." : need(r);
    }
    case "pin":
      return !/^\d{4}$/.test(str(v, "pin"))
        ? "Your PIN must be 4 digits."
        : str(v, "pin") !== str(v, "pin2")
          ? "The two PINs don't match."
          : null;
  }
  const k = `c_${q.id}`;
  if (q.kind === "multi")
    return q.required && !list(v, k).length
      ? `Pick at least one for “${q.label}”.`
      : null;
  const x = str(v, k);
  if (q.kind === "number" && x && !Number.isFinite(Number(x)))
    return "That needs a number.";
  return need(x);
}

/** Signup, one question per screen: Back top-left, Continue (or Enter) bottom-right. */
export function InteractiveForm({
  form,
  next,
  email,
}: {
  form: SignupForm;
  next: string;
  email: string;
}) {
  const steps = form.questions.filter((q) => q.on);
  const [i, setI] = useState(0);
  const [v, setV] = useState<Vals>({});
  const [err, setErr] = useState<string | null>(null);
  const [state, action, pending] = useActionState(createProfile, null);
  const stage = useRef<HTMLDivElement>(null);
  const last = i === steps.length - 1;

  useEffect(() => {
    const t = setTimeout(() => {
      stage.current
        ?.querySelector<HTMLElement>(
          `[data-step="${i}"] :is(input:not([type=checkbox]),select,textarea,button)`,
        )
        ?.focus({ preventScroll: true });
    }, 200);
    return () => clearTimeout(t);
  }, [i]);

  const set = (k: string, x: string | string[]) => {
    setV((o) => ({ ...o, [k]: x }));
    setErr(null);
  };
  const go = () => {
    const p = problem(steps[i], v);
    if (p) return setErr(p);
    if (!last) return setI(i + 1);
    const fd = new FormData();
    fd.set("next", next);
    for (const [k, x] of Object.entries(v))
      for (const y of [x].flat()) fd.append(k, y);
    startTransition(() => action(fd));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    if (e.target instanceof HTMLTextAreaElement && !(e.metaKey || e.ctrlKey))
      return;
    e.preventDefault();
    go();
  };
  const pick = (k: string, x: string) => {
    set(k, x);
    if (!last)
      setTimeout(() => setI((n) => Math.min(n + 1, steps.length - 1)), 260);
  };

  const field = (k: string, p: Record<string, unknown> = {}) => (
    <input
      className={s.field}
      value={typeof v[k] === "string" ? (v[k] as string) : ""}
      onChange={(e) => set(k, e.target.value)}
      {...p}
    />
  );
  const picks = (k: string, opts: string[], multi = false) => (
    <div className={s.picks}>
      {opts.map((o) => {
        const on = multi ? list(v, k).includes(o) : v[k] === o;
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            className={s.pick}
            onClick={() =>
              multi
                ? set(
                    k,
                    on ? list(v, k).filter((x) => x !== o) : [...list(v, k), o],
                  )
                : pick(k, o)
            }
          >
            {o}
          </button>
        );
      })}
    </div>
  );

  const body = (q: Question) => {
    switch (q.builtin) {
      case "name":
        return (
          <div className={s.row}>
            {field("firstName", {
              placeholder: "First",
              autoComplete: "given-name",
              maxLength: 40,
            })}
            {field("lastName", {
              placeholder: "Last",
              autoComplete: "family-name",
              maxLength: 40,
            })}
          </div>
        );
      case "nickname":
        return (
          <>
            {field("nickname", {
              placeholder: "Nickname",
              autoComplete: "nickname",
              maxLength: 30,
            })}
            <label className={s.check}>
              <input
                type="checkbox"
                checked={v.useNickname === "on"}
                onChange={(e) =>
                  set("useNickname", e.target.checked ? "on" : "")
                }
              />
              Use it as my name across the app
            </label>
          </>
        );
      case "location":
        return (
          <div className={`${s.row} ${s.loc}`}>
            {field("city", {
              placeholder: "City",
              autoComplete: "address-level2",
              maxLength: 60,
            })}
            <select
              className={s.field}
              value={str(v, "state")}
              onChange={(e) => set("state", e.target.value)}
              aria-label="State"
            >
              <option value="">State</option>
              {STATES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
        );
      case "birthday":
        return field("birthday", { type: "date", autoComplete: "bday" });
      case "phone":
        return field("phone", {
          type: "tel",
          inputMode: "tel",
          autoComplete: "tel",
          placeholder: "(555) 555-5555",
        });
      case "foundUs":
        return q.kind === "choice" && q.options.length
          ? picks("foundUs", q.options)
          : field("foundUs", {
              maxLength: 200,
              placeholder: "Type your answer",
            });
      case "referral":
        return field("referral", {
          inputMode: "numeric",
          maxLength: 6,
          placeholder: "6-digit code",
        });
      case "pin":
        return (
          <div className={s.row}>
            {field("pin", {
              type: "password",
              inputMode: "numeric",
              maxLength: 4,
              placeholder: "PIN",
              autoComplete: "new-password",
            })}
            {field("pin2", {
              type: "password",
              inputMode: "numeric",
              maxLength: 4,
              placeholder: "Again",
              autoComplete: "new-password",
            })}
          </div>
        );
    }
    const k = `c_${q.id}`;
    switch (q.kind) {
      case "long":
        return (
          <textarea
            className={s.field}
            rows={4}
            maxLength={1000}
            value={(v[k] as string) ?? ""}
            onChange={(e) => set(k, e.target.value)}
            placeholder="Type your answer"
          />
        );
      case "choice":
        return picks(k, q.options);
      case "multi":
        return picks(k, q.options, true);
      case "yesno":
        return picks(k, ["Yes", "No"]);
      case "number":
        return field(k, { inputMode: "decimal", placeholder: "0" });
      case "date":
        return field(k, { type: "date" });
      default:
        return field(k, { maxLength: 200, placeholder: "Type your answer" });
    }
  };

  const shown = err ?? (last ? state?.error : null);
  return (
    <form
      className={s.shell}
      onSubmit={(e) => (e.preventDefault(), go())}
      onKeyDown={onKey}
      aria-label="Create your account"
    >
      <div className={s.top}>
        <Button
          type="button"
          className={`w-auto ${i === 0 ? "invisible" : ""}`}
          onClick={() => (setErr(null), setI(i - 1))}
          still="fade"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back
        </Button>
        <span className={s.count}>
          {String(i + 1).padStart(2, "0")} /{" "}
          {String(steps.length).padStart(2, "0")}
        </span>
      </div>
      <div ref={stage} className={s.stage}>
        {steps.map((q, k) => (
          <section
            key={q.id}
            data-step={k}
            className={`${s.step} ${k === i ? s.on : k < i ? s.past : ""}`}
            inert={k !== i}
            aria-hidden={k !== i}
          >
            <h1 className={s.q}>
              {k === 0 && <small>WELCOME · {email}</small>}
              {q.label}
              {!q.required && (
                <span className="text-base font-semibold text-muted">
                  {" "}
                  (optional)
                </span>
              )}
            </h1>
            {(q.help || (k === 0 && form.intro)) && (
              <p className={s.help}>
                {k === 0 && form.intro ? `${form.intro} ` : ""}
                {q.help}
              </p>
            )}
            {body(q)}
            {k === i && shown && (
              <p role="alert" className={s.error}>
                {shown}
              </p>
            )}
          </section>
        ))}
      </div>
      <div className={s.foot}>
        <div className={s.dots} aria-hidden>
          {steps.map((q, k) => (
            <i
              key={q.id}
              data-on={k === i ? "" : undefined}
              data-done={k < i ? "" : undefined}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className={s.enter}>
            or press Enter{" "}
            <CornerDownLeft className="inline size-3" aria-hidden />
          </span>
          <Button
            type="submit"
            variant="primary"
            className="w-auto px-6"
            disabled={pending}
          >
            {pending ? "Saving…" : last ? "Finish" : "Continue"}
          </Button>
        </div>
      </div>
    </form>
  );
}
