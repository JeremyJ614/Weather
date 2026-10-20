"use server";

import { revalidatePath, updateTag } from "next/cache";
import { SITE_DEFAULTS_TAG } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { checkOrg, type Status } from "@/lib/disaster/data";
import { reviewSignup } from "@/lib/disaster/review";

export type SaveState = { error?: string; saved?: boolean } | null;
const ID = /^[0-9a-f-]{36}$/;
const done = () => {
  revalidatePath("/disaster-response");
  revalidatePath("/admin/disaster");
};

/** Adds an organization (listed at once) or saves an edit to one. */
export async function saveOrg(_: SaveState, fd: FormData): Promise<SaveState> {
  const { supabase } = await requireAdmin("disaster");
  const org = checkOrg(
    (k) => String(fd.get(k) ?? ""),
    (k) => fd.getAll(k).map(String),
  );
  if ("error" in org) return org;
  const id = String(fd.get("id") ?? "");
  const sort = Math.max(0, Math.min(999, Number(fd.get("sort")) || 100));
  const { error } = ID.test(id)
    ? await supabase
        .from("disaster_orgs")
        .update({ ...org, sort })
        .eq("id", id)
    : await supabase.from("disaster_orgs").insert({
        ...org,
        sort,
        status: "approved",
        reviewed_at: new Date().toISOString(),
      });
  if (error) return { error: "Couldn't save. Try again." };
  await supabase.rpc("log_admin", {
    p_action: ID.test(id) ? "edit_disaster_org" : "add_disaster_org",
    p_target: ID.test(id) ? id : org.name,
    p_detail: { name: org.name },
  });
  done();
  return { saved: true };
}

export async function setStatus(id: string, status: Status) {
  const { supabase } = await requireAdmin("disaster");
  return reviewSignup(supabase, id, status);
}

export async function remove(id: string) {
  const { supabase } = await requireAdmin("disaster");
  if (!ID.test(id)) return { error: "That entry couldn't be found." };
  const { error } = await supabase.from("disaster_orgs").delete().eq("id", id);
  if (error) return { error: "Couldn't delete. Try again." };
  await supabase.rpc("log_admin", {
    p_action: "delete_disaster_org",
    p_target: id,
    p_detail: {},
  });
  done();
  return {};
}

/** Turns the Storm Shelter map on Disaster Response on or off (the "shelters" switch). */
export async function setShelterMap(on: boolean) {
  const { supabase } = await requireAdmin("disaster");
  const { data } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "disabled_modules")
    .maybeSingle();
  const was = Array.isArray(data?.value) ? (data.value as string[]) : [];
  const next = on
    ? was.filter((m) => m !== "shelters")
    : [...new Set([...was, "shelters"])];
  const { error } = await supabase
    .from("app_config")
    .update({ value: next, updated_at: new Date().toISOString() })
    .eq("key", "disabled_modules");
  if (error) return { error: "Couldn't save. Try again." };
  await supabase.rpc("log_admin", {
    p_action: on ? "shelter_map_on" : "shelter_map_off",
    p_target: "disaster-response",
    p_detail: {},
  });
  updateTag(SITE_DEFAULTS_TAG);
  revalidatePath("/disaster-response");
  return {};
}
