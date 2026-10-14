"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/viewer";
import type { Poll } from "./PollsView";

/** Casts one vote; returns the poll with its results (shown after voting). */
export async function vote(
  id: string,
  choice: number,
): Promise<Poll | { error: string }> {
  if (!/^[0-9a-f-]{36}$/.test(id) || !Number.isInteger(choice))
    return { error: "That vote couldn't be read." };
  const viewer = await getViewer();
  const sb = await supabaseServer();
  // Viewing as a member: the vote is theirs, cast through an audited owner-only call.
  const { error } = viewer.lens
    ? await sb.rpc("lens_poll_vote", {
        p_user: viewer.id!,
        p_poll: id,
        p_choice: choice,
      })
    : await sb.rpc("poll_vote", { p_poll: id, p_choice: choice });
  if (error)
    return {
      error:
        error.code === "P0002"
          ? "This poll has closed."
          : error.code === "42501"
            ? "Sign in to vote."
            : "Your vote couldn't be sent. Try again.",
    };
  const { data } = viewer.lens
    ? await sb.rpc("lens_poll_list", { p_user: viewer.id! })
    : await sb.rpc("poll_list");
  const poll = ((data ?? []) as Poll[]).find((p) => p.id === id);
  return poll ?? { error: "Your vote counted; refresh to see the results." };
}
