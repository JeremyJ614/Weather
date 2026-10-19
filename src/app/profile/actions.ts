"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export type ProfileEdit = {
  first_name: string;
  last_name: string;
  nickname: string;
  use_nickname: boolean;
  city: string;
  state: string;
  phone: string;
};

/** Saves the member's own descriptive fields; RLS and the profiles guard decide what may change. */
export async function saveProfile(
  e: ProfileEdit,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const first = e.first_name.trim();
  const last = e.last_name.trim();
  const nick = e.nickname.trim();
  const city = e.city.trim();
  const state = e.state.trim().toUpperCase();
  const phone = e.phone.replace(/[^\d+]/g, "");
  if (!first || first.length > 40 || !last || last.length > 40)
    return { ok: false, error: "First and last name are 1–40 characters." };
  if (nick.length > 30)
    return { ok: false, error: "Nickname is 30 characters at most." };
  if (e.use_nickname && !nick)
    return {
      ok: false,
      error: "Add a nickname to show it instead of your name.",
    };
  if (!city || city.length > 60) return { ok: false, error: "Add your city." };
  if (!/^[A-Z]{2}$/.test(state))
    return { ok: false, error: "Use the two-letter state code." };
  if (phone && !/^\+?\d{10,15}$/.test(phone))
    return { ok: false, error: "Phone is 10–15 digits." };
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in again to save." };
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: first,
      last_name: last,
      nickname: nick || null,
      use_nickname: e.use_nickname && !!nick,
      city,
      state,
      phone: phone || null,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save just now. Try again." };
  revalidatePath("/profile");
  return { ok: true };
}
