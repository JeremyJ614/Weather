"use client";

import { useEffect, useState } from "react";
import { RotateCw, ShieldCheck } from "lucide-react";
import s from "./HumanCheck.module.css";

type Challenge = {
  salt: string;
  challenge: string;
  signature: string;
  max: number;
};

const hex = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

/** Finds the number behind the server's puzzle, a slice at a time so the page stays smooth. */
async function solve(c: Challenge, onProgress: (p: number) => void) {
  const enc = new TextEncoder();
  for (let start = 0; start <= c.max; start += 1500) {
    const end = Math.min(c.max, start + 1499);
    for (let n = start; n <= end; n++) {
      const d = await crypto.subtle.digest("SHA-256", enc.encode(c.salt + n));
      if (hex(d) === c.challenge) return n;
    }
    onProgress(end / c.max);
    await new Promise((r) => setTimeout(r, 0));
  }
  return null;
}

/**
 * The signup human check: runs on its own as soon as the screen opens and fills a hidden
 * `human` field with the solved puzzle. No pictures to pick, nothing sent anywhere else.
 */
export function HumanCheck({
  name = "human",
  onDone,
}: {
  name?: string;
  /** Told when the check passes (or starts over). */
  onDone?: (ok: boolean) => void;
}) {
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [p, setP] = useState(0);
  const [value, setValue] = useState("");
  const [run, setRun] = useState(0);

  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      setState("working");
      setP(0);
      onDone?.(false);
    });
    fetch("/api/captcha", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Challenge>) : Promise.reject()))
      .then(async (c) => {
        const n = await solve(c, (x) => live && setP(x));
        if (!live) return;
        if (n == null) throw new Error("unsolved");
        setValue(JSON.stringify({ ...c, number: n }));
        setState("done");
        onDone?.(true);
      })
      .catch(() => live && setState("error"));
    return () => {
      live = false;
    };
  }, [run, onDone]);

  return (
    <div className={s.box} data-state={state} role="status" aria-live="polite">
      <input type="hidden" name={name} value={value} />
      <span className={s.ring} style={{ ["--p" as string]: p }}>
        <ShieldCheck aria-hidden />
      </span>
      <span className={s.text}>
        <b>
          {state === "done"
            ? "You're human. Thanks!"
            : state === "error"
              ? "The human check couldn't finish"
              : "Checking you're human…"}
        </b>
        <small>
          {state === "error"
            ? "Check your connection, then try again."
            : "A quick puzzle your phone solves on its own. Nothing to click."}
        </small>
      </span>
      {state === "error" && (
        <button
          type="button"
          className={s.retry}
          onClick={() => setRun((r) => r + 1)}
          aria-label="Run the human check again"
        >
          <RotateCw aria-hidden />
        </button>
      )}
    </div>
  );
}
