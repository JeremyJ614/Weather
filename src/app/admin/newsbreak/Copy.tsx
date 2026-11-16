"use client";

import { useState } from "react";
import s from "./NewsBreak.module.css";

export function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={s.copy}
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        })
      }
    >
      {done ? "Copied" : "Copy post"}
    </button>
  );
}
