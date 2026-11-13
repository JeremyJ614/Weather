import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Viewer } from "@/lib/auth/viewer";
import {
  DEFAULT_CENTER,
  DEFAULT_ROSTER,
  type AppCenter,
  type Roster,
  type Stats,
  type Submission,
} from "./types";

/**
 * The SSWX documents live as JSON in a private Storage bucket, written only by the server
 * with the service key (the owner can't reach the database's SQL right now, so no new tables).
 * Every read and write goes through the access checks in the pages and actions.
 */
const BUCKET = "sswx";
let ready: Promise<void> | null = null;
function bucket() {
  ready ??= supabaseAdmin()
    .storage.createBucket(BUCKET, { public: false })
    .then(
      () => undefined,
      () => undefined,
    );
  return ready.then(() => supabaseAdmin().storage.from(BUCKET));
}

async function read<T>(path: string, fallback: T): Promise<T> {
  try {
    const { data } = await (await bucket()).download(path);
    if (!data) return fallback;
    return { ...fallback, ...(JSON.parse(await data.text()) as T) };
  } catch {
    return fallback;
  }
}
async function write(path: string, value: unknown) {
  const { error } = await (
    await bucket()
  ).upload(
    path,
    new Blob([JSON.stringify(value)], { type: "application/json" }),
    { upsert: true, contentType: "application/json" },
  );
  if (error) throw new Error(error.message);
}

export const getRoster = () => read<Roster>("roster.json", DEFAULT_ROSTER);
export const saveRoster = (r: Roster) => write("roster.json", r);
export const getCenter = () => read<AppCenter>("center.json", DEFAULT_CENTER);
export const saveCenter = (c: AppCenter) => write("center.json", c);
export const getSubmissions = async () =>
  (await read<{ list: Submission[] }>("submissions.json", { list: [] })).list;
export const saveSubmissions = (list: Submission[]) =>
  write("submissions.json", { list });

export const getStats = () => read<Stats>("stats.json", {});
export async function bump(app: string, k: "views" | "starts" | "done") {
  const st = await getStats();
  const x = (st[app] ??= { views: 0, starts: 0, done: 0 });
  x[k] += 1;
  await write("stats.json", st).catch(() => undefined);
}

/**
 * Only SSWX Members and Recruits see the SSWX section (owner, 2026-11-13): admins who aren't
 * members manage it from admin → SSWX but don't get the section; nobody else learns it exists.
 */
export const canSeeSswx = (v: Viewer) =>
  v.signedIn && (v.roles.includes("member") || v.roles.includes("recruit"));
