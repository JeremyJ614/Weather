"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  bump,
  canSeeSswx,
  getCenter,
  getSubmissions,
  saveSubmissions,
} from "@/lib/sswx/store";
import {
  missing,
  shown,
  uid,
  type Answer,
  type Application,
  type Field,
} from "@/lib/sswx/types";

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

function check(app: Application, a: Record<string, Answer>) {
  for (const f of app.fields) {
    if (!shown(f, a)) continue;
    const m = missing(f, a[f.id]);
    if (m) return `${f.label}: ${m}`;
  }
  return null;
}
const keep = (app: Application, a: Record<string, Answer>) => {
  const k: Record<string, Answer> = {};
  for (const f of app.fields) if (f.id in a && shown(f, a)) k[f.id] = a[f.id];
  return k;
};

/** Funnel stats: an application opened, or its first answer given. */
export async function track(appId: string, k: "views" | "starts") {
  const v = await getViewer();
  if (canSeeSswx(v) && /^[a-z0-9]{1,16}$/.test(appId)) await bump(appId, k);
}

/** Edit & resubmit: allowed while the status says so; goes back to the first status. */
export async function resubmit(
  subId: string,
  answers: Record<string, Answer>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = await getViewer();
  if (!canSeeSswx(v) || !v.id) return { ok: false, error: "Not allowed." };
  const [center, list] = await Promise.all([getCenter(), getSubmissions()]);
  const s = list.find((x) => x.id === subId && x.user === v.id);
  const app = center.applications.find((a) => a.id === s?.app);
  if (!s || !app || !center.statuses.find((x) => x.id === s.status)?.edit)
    return { ok: false, error: "This application can't be edited now." };
  const bad = check(app, answers);
  if (bad) return { ok: false, error: bad };
  s.answers = keep(app, answers);
  s.status = center.statuses[0]?.id ?? s.status;
  (s.history ??= []).push({ at: new Date().toISOString(), status: s.status });
  await saveSubmissions(list);
  revalidatePath("/sswx/applications");
  return { ok: true };
}

/** Interview booking: the applicant picks one of the application's slots. */
export async function pickSlot(subId: string, slot: string) {
  const v = await getViewer();
  if (!canSeeSswx(v) || !v.id) return;
  const [center, list] = await Promise.all([getCenter(), getSubmissions()]);
  const s = list.find((x) => x.id === subId && x.user === v.id);
  const app = center.applications.find((a) => a.id === s?.app);
  if (!s || !app?.slots?.includes(slot)) return;
  if (list.some((x) => x.app === app.id && x.slot === slot && x.id !== s.id))
    return;
  s.slot = slot;
  await saveSubmissions(list);
  revalidatePath("/sswx/applications");
}

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
  const bad = check(app, answers);
  if (bad) return { ok: false, error: bad };
  const { data } = await (await supabaseServer()).auth.getClaims();
  const email = String(data?.claims?.email ?? "");
  const kept = keep(app, answers);
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
    history: [
      {
        at: new Date().toISOString(),
        status: center.statuses[0]?.id ?? "received",
      },
    ],
  });
  await bump(app.id, "done");
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
