"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  canSeeSswx,
  getCenter,
  getSubmissions,
  saveSubmissions,
} from "@/lib/sswx/store";
import { missing, uid, type Answer, type Field } from "@/lib/sswx/types";

const show = (f: Field, v: Answer | undefined) =>
  v === undefined || v === ""
    ? "—"
    : f.type === "signature"
      ? "(signed)"
      : typeof v === "object" && !Array.isArray(v)
        ? Object.entries(v)
            .filter(([, x]) => x)
            .map(([k, x]) => `${k}: ${x}`)
            .join(", ")
        : String(v);

/** Files an application: kept for the Application Center, and sent to the admin inbox. */
export async function submitApplication(
  appId: string,
  answers: Record<string, Answer>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = await getViewer();
  if (!canSeeSswx(v) || !v.id) return { ok: false, error: "Not allowed." };
  if (JSON.stringify(answers).length > 600_000)
    return { ok: false, error: "That's too much to send in one application." };
  const center = await getCenter();
  const app = center.applications.find((a) => a.id === appId);
  if (!app?.open) return { ok: false, error: "This application is closed." };
  for (const f of app.fields) {
    const m = missing(f, answers[f.id]);
    if (m) return { ok: false, error: `${f.label}: ${m}` };
  }
  const { data } = await (await supabaseServer()).auth.getClaims();
  const email = String(data?.claims?.email ?? "");
  const kept: Record<string, Answer> = {};
  for (const f of app.fields) if (f.id in answers) kept[f.id] = answers[f.id];
  const list = await getSubmissions();
  list.unshift({
    id: uid(),
    app: app.id,
    appTitle: app.title,
    user: v.id,
    name: v.name ?? "Member",
    email,
    at: new Date().toISOString(),
    status: center.statuses[0]?.id ?? "received",
    note: "",
    answers: kept,
  });
  await saveSubmissions(list);
  const body = app.fields
    .filter((f) => f.type !== "section")
    .map((f) => `${f.label}: ${show(f, kept[f.id])}`)
    .join("\n")
    .slice(0, 3900);
  await supabaseAdmin()
    .from("contact_messages")
    .insert({
      form: "sswx-application",
      user_id: v.id,
      name: (v.name ?? "Member").slice(0, 80),
      email: email || "unknown@sswx.space",
      subject: `Application: ${app.title}`.slice(0, 120),
      body: `${body}\n\nReview and set its status in admin → SSWX → Submissions.`,
    });
  revalidatePath("/sswx/applications");
  return { ok: true };
}
