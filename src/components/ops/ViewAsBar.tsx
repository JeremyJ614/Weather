"use client";

import { useSyncExternalStore } from "react";
import { Eye, Undo2, Users } from "lucide-react";
import { stopLens } from "@/app/admin/actions";
import s from "./ViewAsBar.module.css";

const read = () => {
  const m = /(?:^|; )sswx-lens-name=([^;]*)/.exec(document.cookie);
  try {
    return m ? decodeURIComponent(decodeURIComponent(m[1])) : "";
  } catch {
    return "";
  }
};
const subscribe = (cb: () => void) => {
  const t = setInterval(cb, 2000);
  addEventListener("focus", cb);
  return () => {
    clearInterval(t);
    removeEventListener("focus", cb);
  };
};

/** While the owner views the app as a member: whose view it is, and one tap back (to the member or to the list). */
export function ViewAsBar() {
  const name = useSyncExternalStore(subscribe, read, () => "");
  if (!name) return null;
  return (
    <form action={stopLens} className={s.bar}>
      <span className={s.who}>
        <Eye aria-hidden /> Viewing as <b>{name}</b>
      </span>
      <button
        type="submit"
        name="to"
        value="members"
        className={s.back}
        aria-label="Back to the members list"
      >
        <Users aria-hidden /> <span className={s.wide}>Back to</span> members
      </button>
      <button type="submit" className={s.back}>
        <Undo2 aria-hidden /> Back to me
      </button>
    </form>
  );
}
