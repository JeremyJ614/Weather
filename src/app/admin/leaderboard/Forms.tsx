"use client";

import { useActionState, useEffect, useState } from "react";
import { Crown, MinusCircle, PlusCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import {
  adjustPoints,
  findMembers,
  saveTitle,
  type AdminState,
} from "./actions";
import s from "./Admin.module.css";

type Member = { user_id: string; name: string };

/** Search-and-pick a member; writes `user_id` and `name` hidden fields. */
function MemberPick({
  value,
  onChange,
  optional,
}: {
  value: Member | null;
  onChange: (m: Member | null) => void;
  optional?: boolean;
}) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Member[]>([]);
  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    const t = setTimeout(
      () =>
        findMembers(term)
          .then(setList)
          .catch(() => setList([])),
      200,
    );
    return () => clearTimeout(t);
  }, [q]);
  if (value)
    return (
      <div className={s.picked}>
        <input type="hidden" name="user_id" value={value.user_id} />
        <input type="hidden" name="name" value={value.name} />
        <b>{value.name}</b>
        <button type="button" onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    );
  return (
    <div className="grid gap-2">
      <label className={s.field}>
        <Search aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={optional ? "Find a member (optional)" : "Find a member"}
          aria-label="Find a member"
          autoComplete="off"
        />
      </label>
      {q.trim() && list.length > 0 && (
        <ul className={s.results}>
          {list.map((m) => (
            <li key={m.user_id}>
              <button
                type="button"
                onClick={() => {
                  onChange(m);
                  setQ("");
                  setList([]);
                }}
              >
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Result({ state }: { state: AdminState }) {
  if (!state) return null;
  return (
    <p className={state.error ? s.err : s.ok} role="status">
      {state.error ?? state.ok}
    </p>
  );
}

export function AdjustForm({ today }: { today: string }) {
  const [member, setMember] = useState<Member | null>(null);
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [state, action, pending] = useActionState(adjustPoints, null);
  return (
    <form action={action} className={s.card}>
      <h2>
        <PlusCircle aria-hidden /> Add or remove points
      </h2>
      <MemberPick value={member} onChange={setMember} />
      <div className={s.row}>
        <Chip pressed={sign === 1} onClick={() => setSign(1)}>
          <PlusCircle className="mr-1 inline size-3.5" aria-hidden /> Add
        </Chip>
        <Chip pressed={sign === -1} onClick={() => setSign(-1)}>
          <MinusCircle className="mr-1 inline size-3.5" aria-hidden /> Remove
        </Chip>
      </div>
      <input
        type="hidden"
        name="points"
        value={amount ? sign * Number(amount) : ""}
      />
      <label className={s.label}>
        Points
        <input
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          placeholder="250"
          required
        />
      </label>
      <label className={s.label}>
        Counts on
        <input type="date" name="on" defaultValue={today} max={today} />
      </label>
      <label className={s.label}>
        Reason
        <input
          name="note"
          maxLength={140}
          placeholder="Tiebreaker bonus"
          required
        />
      </label>
      <Button type="submit" variant="primary" disabled={pending || !member}>
        {pending ? "Saving…" : sign > 0 ? "Add points" : "Remove points"}
      </Button>
      <Result state={state} />
    </form>
  );
}

export function TitleForm({ today }: { today: string }) {
  const [kind, setKind] = useState<"month" | "year">("month");
  const [member, setMember] = useState<Member | null>(null);
  const [state, action, pending] = useActionState(saveTitle, null);
  return (
    <form action={action} className={s.card}>
      <h2>
        <Crown aria-hidden /> Add a past champion
      </h2>
      <input type="hidden" name="kind" value={kind} />
      <div className={s.row}>
        <Chip pressed={kind === "month"} onClick={() => setKind("month")}>
          Monthly
        </Chip>
        <Chip pressed={kind === "year"} onClick={() => setKind("year")}>
          Yearly
        </Chip>
      </div>
      {kind === "month" ? (
        <label className={s.label}>
          Month
          <input type="month" name="month" max={today.slice(0, 7)} required />
        </label>
      ) : (
        <label className={s.label}>
          Year
          <input
            name="year"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            placeholder={today.slice(0, 4)}
            required
          />
        </label>
      )}
      <MemberPick value={member} onChange={setMember} optional />
      {!member && (
        <label className={s.label}>
          Or the champion&apos;s name (from before the app)
          <input name="name" maxLength={60} placeholder="Jay M." />
        </label>
      )}
      <label className={s.label}>
        Winning points (optional)
        <input name="points" inputMode="numeric" placeholder="12,450" />
      </label>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : "Save champion"}
      </Button>
      <Result state={state} />
    </form>
  );
}
