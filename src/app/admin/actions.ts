"use server";

import { revalidatePath, updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LENS_COOKIE, LENS_NAME } from "@/lib/auth/lens-cookie";
import { SITE_DEFAULTS_TAG, cleanDefaults } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { sectionIds } from "@/lib/admin/sections";
import { moduleIds } from "@/lib/ops/modules";
import { cleanForm } from "@/lib/auth/signup-form";
import { ICON_NAMES } from "@/components/NavIcon";
import { cleanLayout } from "@/lib/nav/layout";
import { EVERY_PAGE } from "@/lib/nav/extras";

const UUID = /^[0-9a-f-]{36}$/;

async function founder() {
  const ctx = await requireAdmin();
  if (!ctx.isFounder)
    throw new Error("Only the Founder can change admin access");
  return ctx;
}

export async function grantAdmin(fd: FormData) {
  const { supabase, viewer } = await founder();
  const id = String(fd.get("userId") ?? "");
  const name = String(fd.get("name") ?? "");
  if (!UUID.test(id)) return;
  const { error } = await supabase
    .from("user_roles")
    .insert({ user_id: id, role: "admin" });
  if (!error)
    await supabase.rpc("log_admin", {
      p_action: "grant_admin",
      p_target: name,
      p_detail: { by: viewer.name },
    });
  revalidatePath("/admin/admins");
}

export async function removeAdmin(fd: FormData) {
  const { supabase } = await founder();
  const id = String(fd.get("userId") ?? "");
  const name = String(fd.get("name") ?? "");
  if (!UUID.test(id)) return;
  await supabase.from("admin_permissions").delete().eq("user_id", id);
  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", id)
    .eq("role", "admin");
  if (!error)
    await supabase.rpc("log_admin", {
      p_action: "remove_admin",
      p_target: name,
    });
  revalidatePath("/admin/admins");
}

export async function setSections(fd: FormData) {
  const { supabase } = await founder();
  const id = String(fd.get("userId") ?? "");
  const name = String(fd.get("name") ?? "");
  if (!UUID.test(id)) return;
  const want = fd
    .getAll("section")
    .map(String)
    .filter((s) => sectionIds.has(s) && s !== "admins");
  await supabase.from("admin_permissions").delete().eq("user_id", id);
  if (want.length) {
    await supabase
      .from("admin_permissions")
      .insert(want.map((section) => ({ user_id: id, section })));
  }
  await supabase.rpc("log_admin", {
    p_action: "set_sections",
    p_target: name,
    p_detail: { sections: want },
  });
  revalidatePath("/admin/admins");
}

export type SaveState = { error?: string; saved?: boolean } | null;

/** Menu & theme defaults for everyone who hasn't picked their own. */
export async function saveDefaults(
  _: SaveState,
  fd: FormData,
): Promise<SaveState> {
  const { supabase } = await requireAdmin("menus");
  const want = cleanDefaults([
    {
      key: "menu_defaults",
      value: { main: fd.get("main"), second: fd.get("second") },
    },
    {
      key: "theme_default",
      value: { palette: fd.get("palette"), font: fd.get("font") },
    },
  ]);
  const results = await Promise.all([
    supabase
      .from("app_config")
      .update({ value: want.menus, updated_at: new Date().toISOString() })
      .eq("key", "menu_defaults")
      .select("key"),
    supabase
      .from("app_config")
      .update({ value: want.theme, updated_at: new Date().toISOString() })
      .eq("key", "theme_default")
      .select("key"),
  ]);
  if (results.some((r) => r.error || !r.data?.length))
    return { error: "The defaults couldn't be saved. Try again." };
  await supabase.rpc("log_admin", {
    p_action: "set_defaults",
    p_target: "menus & theme",
    p_detail: want,
  });
  updateTag(SITE_DEFAULTS_TAG);
  return { saved: true };
}

/** Kill switches and the maintenance banner. */
export async function saveOps(_: SaveState, fd: FormData): Promise<SaveState> {
  const { supabase } = await requireAdmin("ops");
  const disabled = fd
    .getAll("off")
    .map(String)
    .filter((m) => moduleIds.has(m));
  const text = String(fd.get("bannerText") ?? "")
    .trim()
    .slice(0, 200);
  const untilRaw = String(fd.get("bannerUntil") ?? "");
  const until =
    untilRaw && !Number.isNaN(Date.parse(untilRaw))
      ? new Date(untilRaw).toISOString()
      : null;
  const now = new Date().toISOString();
  const results = await Promise.all([
    supabase
      .from("app_config")
      .update({ value: disabled, updated_at: now })
      .eq("key", "disabled_modules"),
    supabase
      .from("app_config")
      .update({ value: { text, until }, updated_at: now })
      .eq("key", "banner"),
  ]);
  if (results.some((r) => r.error))
    return { error: "Couldn't save. Try again." };
  await supabase.rpc("log_admin", {
    p_action: "set_ops",
    p_target: "switches & banner",
    p_detail: { disabled, text, until },
  });
  updateTag(SITE_DEFAULTS_TAG);
  return { saved: true };
}

/** Grant or take away SSWX Member. */
export async function setMember(fd: FormData) {
  const { supabase } = await requireAdmin("members");
  const id = String(fd.get("userId") ?? "");
  const name = String(fd.get("name") ?? "");
  const on = fd.get("on") === "1";
  if (!UUID.test(id)) return;
  const { error } = on
    ? await supabase.from("user_roles").insert({ user_id: id, role: "member" })
    : await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", id)
        .eq("role", "member");
  if (!error)
    await supabase.rpc("log_admin", {
      p_action: on ? "grant_member" : "remove_member",
      p_target: name,
    });
  revalidatePath(`/admin/members/${id}`);
}

/** Saves the signup questions (order, on/off, required, the owner's own questions). */
export async function saveSignupForm(json: string): Promise<SaveState> {
  const { supabase } = await requireAdmin("signup-form");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { error: "The form couldn't be read. Reload and try again." };
  }
  const form = cleanForm(raw);
  const { data, error } = await supabase
    .from("app_config")
    .update({ value: form, updated_at: new Date().toISOString() })
    .eq("key", "signup_form")
    .select("key");
  if (error || !data?.length) return { error: "Couldn't save. Try again." };
  await supabase.rpc("log_admin", {
    p_action: "edit_signup_form",
    p_target: "signup form",
    p_detail: { questions: form.questions.length },
  });
  updateTag("signup-form");
  return { saved: true };
}

/** The owner's switch for the Admin group in their second menu (stored on their account). */
export async function setAdminShortcuts(on: boolean): Promise<SaveState> {
  const { supabase, isFounder } = await requireAdmin();
  if (!isFounder) return { error: "Only the owner has admin shortcuts." };
  const { error } = await supabase.auth.updateUser({
    data: { admin_shortcuts: on === true },
  });
  return error
    ? { error: "That couldn't be saved. Try again." }
    : { saved: true };
}

/** Saves the Menu editor's arrangement, or `null` to go back to the built-in menus. */
export async function saveMenuLayout(raw: unknown): Promise<SaveState> {
  const { supabase } = await requireAdmin("menus");
  const layout =
    raw === null
      ? {}
      : cleanLayout(
          raw,
          new Set(EVERY_PAGE.map((p) => p.slug)),
          new Set(ICON_NAMES),
        );
  if (!layout) return { error: "Every menu needs at least one section." };
  const { data, error } = await supabase
    .from("app_config")
    .update({ value: layout, updated_at: new Date().toISOString() })
    .eq("key", "menu_layout")
    .select("key");
  if (error || !data?.length)
    return { error: "The menus couldn't be saved. Try again." };
  await supabase.rpc("log_admin", {
    p_action: raw === null ? "reset_menu_layout" : "set_menu_layout",
    p_target: "menus",
    p_detail: {},
  });
  updateTag(SITE_DEFAULTS_TAG);
  return { saved: true };
}

/** "View as member" (owner only): the app shows that member's view until "Back to me". */
export async function startLens(fd: FormData) {
  const { supabase, isFounder } = await requireAdmin("members");
  const id = String(fd.get("userId") ?? "");
  if (!isFounder || !UUID.test(id)) return;
  const [{ data: ok }, { data: name }] = await Promise.all([
    supabase.rpc("lens_target_ok", { p_user: id }),
    supabase.rpc("member_name", { p_id: id }),
  ]);
  if (!ok) return;
  await supabase.rpc("log_admin", {
    p_action: "view_as_start",
    p_target: String(name ?? id),
    p_detail: { member: id },
  });
  const store = await cookies();
  const opts = {
    path: "/",
    sameSite: "lax" as const,
    secure: true,
    maxAge: 4 * 3600,
  };
  store.set(LENS_COOKIE, id, { ...opts, httpOnly: true });
  store.set(LENS_NAME, encodeURIComponent(String(name ?? "a member")), opts);
  redirect("/");
}

export async function stopLens() {
  const store = await cookies();
  const id = store.get(LENS_COOKIE)?.value;
  store.delete(LENS_COOKIE);
  store.delete(LENS_NAME);
  const { supabase } = await requireAdmin();
  if (id && UUID.test(id)) {
    await supabase.rpc("log_admin", {
      p_action: "view_as_stop",
      p_target: id,
      p_detail: { member: id },
    });
    redirect(`/admin/members/${id}`);
  }
  redirect("/admin");
}
