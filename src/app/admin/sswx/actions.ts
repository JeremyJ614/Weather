"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";
import {
  getSubmissions,
  saveCenter,
  saveRoster,
  saveSubmissions,
} from "@/lib/sswx/store";
import type { AppCenter, Roster } from "@/lib/sswx/types";

const HEX = /^#[0-9a-f]{6}$/i;
const ok = (c: string) => (HEX.test(c) ? c : "#888888");

export async function saveRosterAction(r: Roster) {
  await requireAdmin("members");
  await saveRoster({
    ...r,
    nameColor: ok(r.nameColor),
    departments: r.departments.map((d) => ({ ...d, color: ok(d.color) })),
  });
  revalidatePath("/sswx/roster");
  revalidatePath("/admin/sswx");
}

export async function saveCenterAction(c: AppCenter) {
  await requireAdmin("members");
  await saveCenter({
    ...c,
    applications: c.applications.map((a) => ({ ...a, accent: ok(a.accent) })),
    statuses: c.statuses.map((x) => ({ ...x, color: ok(x.color) })),
    socials: c.socials.map((x) => ({ ...x, color: ok(x.color) })),
  });
  revalidatePath("/sswx/applications");
  revalidatePath("/admin/sswx");
}

export async function setSubmission(id: string, status: string, note: string) {
  await requireAdmin("members");
  const list = await getSubmissions();
  const s = list.find((x) => x.id === id);
  if (!s) return;
  s.status = status;
  s.note = note.slice(0, 2000);
  await saveSubmissions(list);
  revalidatePath("/sswx/applications");
  revalidatePath("/admin/sswx");
}

export async function removeSubmission(id: string) {
  await requireAdmin("members");
  await saveSubmissions((await getSubmissions()).filter((x) => x.id !== id));
  revalidatePath("/admin/sswx");
}
