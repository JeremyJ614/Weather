"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { normEmail, pinPassword } from "@/lib/auth/pin";
import { checkSignup } from "@/lib/auth/signup";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type CreateState = { error?: string } | null;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Creates a member account on someone's behalf (VIP's "Create user"), confirmed and ready. */
export async function createMember(
  _: CreateState,
  fd: FormData,
): Promise<CreateState> {
  const { supabase, viewer } = await requireAdmin("members");
  const s = (k: string) => String(fd.get(k) ?? "").trim();
  const email = normEmail(s("email"));
  const pin = s("pin");
  const f = {
    firstName: s("firstName"),
    lastName: s("lastName"),
    nickname: s("nickname"),
    useNickname: fd.get("useNickname") === "on",
    phone: s("phone").replace(/[\s().-]/g, ""),
    city: s("city"),
    state: s("state"),
    birthday: s("birthday"),
    foundUs: s("foundUs"),
    referral: "",
    pin: pin || "0000",
    pin2: pin || "0000",
  };
  if (!EMAIL.test(email) || email.length > 200)
    return { error: "Enter their email address." };
  if (pin && !/^\d{4}$/.test(pin))
    return { error: "A PIN is 4 digits (or leave it empty)." };
  const problem = checkSignup(f);
  if (problem)
    return {
      error: problem.replace(/\byour\b/gi, "their").replace(/\bYou\b/g, "They"),
    };

  const admin = supabaseAdmin();
  const made = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: pin
      ? pinPassword(email, pin)
      : randomBytes(24).toString("base64url"),
  });
  if (made.error || !made.data.user)
    return {
      error: /already|registered|exists/i.test(made.error?.message ?? "")
        ? "That email already has an account."
        : "The account couldn't be created. Try again.",
    };
  const id = made.data.user.id;
  let saved = false;
  for (let attempt = 0; attempt < 3 && !saved; attempt++) {
    const { data: code } = await admin.rpc("new_referral_code");
    const { error } = await admin.from("profiles").insert({
      id,
      first_name: f.firstName,
      last_name: f.lastName,
      nickname: f.nickname || null,
      use_nickname: f.useNickname,
      phone: f.phone || null,
      city: f.city,
      state: f.state,
      birthday: f.birthday,
      found_us: f.foundUs || null,
      referral_code: code,
      pin_set: Boolean(pin),
    });
    if (!error) saved = true;
    else if (error.code !== "23505" || error.message.includes("pkey")) break;
  }
  if (!saved) {
    await admin.auth.admin.deleteUser(id);
    return {
      error:
        "Their profile couldn't be saved, so nothing was created. Try again.",
    };
  }
  if (fd.get("member") === "on")
    await admin.from("user_roles").insert({ user_id: id, role: "member" });
  const link = fd.get("sendLink") === "on";
  if (link) {
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
    await admin.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${origin}/login` },
    });
  }
  await supabase.rpc("log_admin", {
    p_action: "create_member",
    p_target: `${f.firstName} ${f.lastName}`,
    p_detail: { member: id, by: viewer.name, pin: Boolean(pin), link },
  });
  redirect(
    `/admin/members/${id}?created=${link ? "link" : pin ? "pin" : "none"}`,
  );
}
