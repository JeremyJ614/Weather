"use client";

import dynamic from "next/dynamic";

// Each game's code loads when its tab first opens (review round, speed pick "split-heavy").
const loading = () => <p className="text-sm text-muted">Loading…</p>;
export const GameView = dynamic(
  () => import("./GameView").then((m) => m.GameView),
  { loading },
);
export const TriviaView = dynamic(
  () => import("./TriviaView").then((m) => m.TriviaView),
  { loading },
);
