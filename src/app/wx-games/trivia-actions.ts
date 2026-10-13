"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/viewer";

export type Graded = {
  correct: boolean;
  earned: number;
  answer_index: number;
  explanation: string | null;
};

/** Sends one answer; the database grades it once and pays correct ones. */
export async function answerTrivia(
  id: string,
  choice: number,
): Promise<Graded | { error: string }> {
  if (!/^[0-9a-f-]{36}$/.test(id) || !Number.isInteger(choice))
    return { error: "That answer couldn't be read." };
  const sb = await supabaseServer();
  const viewer = await getViewer();
  const { data, error } = viewer.lens
    ? await sb.rpc("lens_trivia_answer", {
        p_user: viewer.id!,
        p_question: id,
        p_choice: choice,
      })
    : await sb.rpc("trivia_answer", { p_question: id, p_choice: choice });
  if (error)
    return {
      error:
        error.code === "P0002"
          ? "This question has closed. A new set arrives at midnight Eastern."
          : error.code === "42501"
            ? "Sign in to play."
            : "Your answer couldn't be sent. Try again.",
    };
  revalidatePath("/leaderboard");
  return (data as Graded[])[0];
}
