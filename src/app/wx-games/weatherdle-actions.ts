"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/viewer";
import type { WdState } from "./WeatherdleView";

type Out = { state: WdState } | { error: string };

const said = (e: { code?: string; message?: string }) =>
  e.code === "42501"
    ? "Sign in to play."
    : e.code === "P0002"
      ? "Today's word isn't ready yet. Try again in a minute."
      : e.code === "22023" && e.message
        ? e.message.charAt(0).toUpperCase() + e.message.slice(1) + "."
        : "That didn't go through. Try again.";

/** One guess, graded by the database (weatherdle_guess); a solve pays into the points ledger. */
export async function wdGuess(word: string): Promise<Out> {
  const w = String(word ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 14);
  if (w.length < 3) return { error: "Type the whole word first." };
  const [sb, viewer] = await Promise.all([supabaseServer(), getViewer()]);
  // Viewing as a member: their game, through owner-only lens_* calls (logged).
  const { data, error } = viewer.lens
    ? await sb.rpc("lens_weatherdle_guess", { p_user: viewer.id!, p_guess: w })
    : await sb.rpc("weatherdle_guess", { p_guess: w });
  if (error) return { error: said(error) };
  const state = data as WdState;
  if (state.solved) revalidatePath("/leaderboard");
  return { state };
}

/** Shows today's hint (a quarter off a solve). */
export async function wdHint(): Promise<Out> {
  const [sb, viewer] = await Promise.all([supabaseServer(), getViewer()]);
  const { data, error } = viewer.lens
    ? await sb.rpc("lens_weatherdle_hint", { p_user: viewer.id! })
    : await sb.rpc("weatherdle_hint");
  return error ? { error: said(error) } : { state: data as WdState };
}

/** Today's game again (after the word was still being picked). */
export async function wdState(): Promise<Out> {
  const [sb, viewer] = await Promise.all([supabaseServer(), getViewer()]);
  const { data, error } = viewer.lens
    ? await sb.rpc("lens_weatherdle_state", { p_user: viewer.id! })
    : await sb.rpc("weatherdle_state");
  return error ? { error: said(error) } : { state: data as WdState };
}
