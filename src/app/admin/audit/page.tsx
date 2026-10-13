import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";

export const metadata: Metadata = { title: "Audit log · StormSync Media" };

export default async function Audit() {
  const { supabase } = await requireAdmin();
  const { data: rows } = await supabase
    .from("audit_log")
    .select("id, actor, action, target, detail, at")
    .order("at", { ascending: false })
    .limit(100);
  const actors = [...new Set((rows ?? []).map((r) => r.actor))];
  const { data: people } = actors.length
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", actors)
    : { data: [] };
  const who = new Map(
    (people ?? []).map((p) => [
      p.id,
      `${p.first_name} ${p.last_name.slice(0, 1)}.`,
    ]),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-24">
      <h1 className="display text-3xl text-accent">Audit log</h1>
      <p className="mt-1 text-sm text-muted">
        Every admin action, newest first. Entries can&apos;t be edited.
      </p>
      {!rows?.length ? (
        <p className="mt-6 text-muted">No admin actions yet.</p>
      ) : (
        <ol className="mt-6 grid gap-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-sm"
            >
              <span className="font-bold text-accent">
                {r.action.replaceAll("_", " ")}
              </span>
              {r.target && <> · {r.target}</>}
              <span className="block text-xs text-muted">
                {who.get(r.actor) ?? "Unknown"} ·{" "}
                {new Date(r.at).toLocaleString("en-US", {
                  timeZone: "America/Chicago",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                CT
              </span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
