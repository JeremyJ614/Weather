import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Small JSON documents for operations features (usage meter, promotion counters…) in a
 * private Storage bucket, written only by the server with the service key. Used instead of
 * new tables while the database's SQL is out of reach (owner, 2026-11-15).
 */
const BUCKET = "ops";
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

export async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const { data } = await (await bucket()).download(path);
    if (!data) return fallback;
    return JSON.parse(await data.text()) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(path: string, value: unknown) {
  const { error } = await (
    await bucket()
  ).upload(
    path,
    new Blob([JSON.stringify(value)], { type: "application/json" }),
    { upsert: true, contentType: "application/json" },
  );
  if (error) throw new Error(error.message);
}

/** File names directly under a folder (no trailing slash). */
export async function listNames(folder: string) {
  const { data } = await (await bucket()).list(folder, { limit: 1000 });
  return (data ?? []).map((x) => x.name);
}

export async function removeFiles(paths: string[]) {
  if (paths.length) await (await bucket()).remove(paths);
}
