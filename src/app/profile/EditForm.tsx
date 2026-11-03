"use client";

import { useState, useTransition } from "react";
import { saveProfile } from "./actions";
import type { ProfileData } from "./ProfileView";
import s from "./Profile.module.css";

export function EditForm({
  d,
  onDone,
}: {
  d: ProfileData;
  onDone: () => void;
}) {
  const [f, setF] = useState({
    first_name: d.first,
    last_name: d.last,
    nickname: d.nickname,
    use_nickname: d.useNickname,
    city: d.city,
    state: d.state,
    phone: d.phone,
  });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const field = (
    k: "first_name" | "last_name" | "nickname" | "city" | "state" | "phone",
    label: string,
    extra?: object,
  ) => (
    <label>
      <span>{label}</span>
      <input
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
        {...extra}
      />
    </label>
  );
  return (
    <form
      className={s.form}
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        start(async () => {
          const r = await saveProfile(f);
          if (r.ok) onDone();
          else setErr(r.error);
        });
      }}
    >
      <div className={s.grid2}>
        {field("first_name", "First name", {
          maxLength: 40,
          autoComplete: "given-name",
        })}
        {field("last_name", "Last name", {
          maxLength: 40,
          autoComplete: "family-name",
        })}
      </div>
      {field("nickname", "Nickname", { maxLength: 30 })}
      <label className={s.check}>
        <input
          type="checkbox"
          checked={f.use_nickname}
          onChange={(e) => setF({ ...f, use_nickname: e.target.checked })}
        />
        <span>Show my nickname on leaderboards instead of my name</span>
      </label>
      <div className={s.grid2}>
        {field("city", "City", {
          maxLength: 60,
          autoComplete: "address-level2",
        })}
        {field("state", "State", {
          maxLength: 2,
          autoComplete: "address-level1",
        })}
      </div>
      {field("phone", "Phone (optional)", {
        inputMode: "tel",
        autoComplete: "tel",
      })}
      {err && <p className={s.err}>{err}</p>}
      <div className={s.actions}>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" data-primary disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
