"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { send } from "@/lib/notify/deliver";
import type { TopicId } from "@/lib/notify/topics";
import {
  getCenter,
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

export async function setSubmission(
  id: string,
  patch: {
    status?: string;
    note?: string;
    fieldNotes?: Record<string, string>;
    message?: string;
  },
) {
  await requireAdmin("members");
  const [list, center] = await Promise.all([getSubmissions(), getCenter()]);
  const s = list.find((x) => x.id === id);
  if (!s) return;
  const at = new Date().toISOString();
  const changed = patch.status && patch.status !== s.status;
  if (patch.status) s.status = patch.status;
  if (changed) (s.history ??= []).push({ at, status: s.status });
  if (patch.note !== undefined) s.note = patch.note.slice(0, 2000);
  if (patch.fieldNotes) s.fieldNotes = patch.fieldNotes;
  if (patch.message?.trim())
    (s.messages ??= []).push({ at, text: patch.message.trim().slice(0, 1000) });
  await saveSubmissions(list);
  const st = center.statuses.find((x) => x.id === s.status);
  const app = center.applications.find((x) => x.id === s.app);
  const db = supabaseAdmin();
  if (changed && st?.award && app?.badge)
    await db
      .from("member_badges")
      .upsert({ user_id: s.user, badge_id: app.badge });
  // Push alert and in-app notice when the status changes or the team writes.
  if (changed || patch.message?.trim()) {
    const title = `${s.appTitle}: ${changed ? st?.label : "New message"}`.slice(
      0,
      80,
    );
    const body = (
      patch.message?.trim() || "Open the Application Center for details."
    ).slice(0, 300);
    await db
      .from("notifications")
      .insert({ user_id: s.user, level: "info", title, body });
    await send([
      {
        user_id: s.user,
        topic: "sswx" as TopicId,
        key: `${s.id}-${at}`,
        title,
        body,
        url: "/sswx/applications",
      },
    ]).catch(() => undefined);
  }
  revalidatePath("/sswx/applications");
  revalidatePath("/admin/sswx");
}

export async function removeSubmission(id: string) {
  await requireAdmin("members");
  await saveSubmissions((await getSubmissions()).filter((x) => x.id !== id));
  revalidatePath("/admin/sswx");
}
