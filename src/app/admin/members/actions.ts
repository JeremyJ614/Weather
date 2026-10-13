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

export type ToolState = { error?: string; ok?: string } | null;

async function target(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const admin = supabaseAdmin();
  const [{ data: u }, { data: roles }, { data: p }] = await Promise.all([
    admin.auth.admin.getUserById(id),
    admin.from("user_roles").select("role").eq("user_id", id),
    admin
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!u.user?.email || !p) return null;
  return {
    admin,
    email: u.user.email,
    name: `${p.first_name} ${p.last_name}`,
    staff: (roles ?? []).some(
      (r) => r.role === "admin" || r.role === "founder",
    ),
  };
}

/** Sets a new 4-digit PIN for a member (VIP's "Reset PIN"); clears any lockout. */
export async function resetPin(_: ToolState, fd: FormData): Promise<ToolState> {
  const { supabase } = await requireAdmin("members");
  const pin = String(fd.get("pin") ?? "");
  if (!/^\d{4}$/.test(pin)) return { error: "A PIN is 4 digits." };
  const t = await target(String(fd.get("userId") ?? ""));
  if (!t) return { error: "That member couldn't be found." };
  if (t.staff) return { error: "Admins change their own PIN." };
  const { error } = await t.admin.auth.admin.updateUserById(
    String(fd.get("userId")),
    { password: pinPassword(t.email, pin) },
  );
  if (error) return { error: "The PIN couldn't be saved. Try again." };
  await t.admin
    .from("profiles")
    .update({ pin_set: true })
    .eq("id", String(fd.get("userId")));
  await supabase.rpc("log_admin", { p_action: "reset_pin", p_target: t.name });
  return { ok: "New PIN saved. Tell them in person or by text." };
}

/** Removes a member's account and everything tied to it. Typed confirmation; never admins. */
export async function removeMember(
  _: ToolState,
  fd: FormData,
): Promise<ToolState> {
  const { supabase } = await requireAdmin("members");
  const id = String(fd.get("userId") ?? "");
  const t = await target(id);
  if (!t) return { error: "That member couldn't be found." };
  if (t.staff) return { error: "Admins and the owner can't be removed here." };
  if (
    String(fd.get("confirm") ?? "")
      .trim()
      .toLowerCase() !== t.name.toLowerCase()
  )
    return { error: `Type “${t.name}” to confirm.` };
  // People they referred keep their accounts; only the link back goes.
  await t.admin
    .from("profiles")
    .update({ referred_by: null })
    .eq("referred_by", id);
  const { error } = await t.admin.auth.admin.deleteUser(id);
  if (error) return { error: "The account couldn't be removed. Try again." };
  await supabase.rpc("log_admin", {
    p_action: "remove_member",
    p_target: t.name,
  });
  redirect("/admin/members");
}
