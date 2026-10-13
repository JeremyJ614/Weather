import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";

export const metadata: Metadata = {
  title: "Error inbox · Admin · StormSync Media",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  });

export default async function Errors() {
  const { supabase } = await requireAdmin("errors");
  const { data: rows } = await supabase
    .from("client_errors")
    .select(
      "fingerprint, message, page, device, stack, count, first_seen, last_seen",
    )
    .order("last_seen", { ascending: false })
    .limit(100);
  return (
    <main className="mx-auto max-w-2xl px-4 pt-6 pb-24">
      <h1 className="display text-3xl text-accent">Error inbox</h1>
      <p className="mt-1 text-sm text-muted">
        Browser errors grouped by message and page. Groups unseen for 30 days
        are cleared.
      </p>
      {!rows?.length ? (
        <p className="mt-6 text-muted">No errors reported. 🎉</p>
      ) : (
        <ul className="mt-6 grid gap-2">
          {rows.map((r) => (
            <li key={r.fingerprint}>
              <details className="rounded-xl border border-line bg-surface px-3 py-2">
                <summary className="cursor-pointer list-none">
                  <span className="font-bold text-accent">×{r.count}</span>{" "}
                  {r.message}
                  <span className="block text-xs text-muted">
                    {r.page} · {r.device ?? "unknown device"} · last{" "}
                    {when(r.last_seen)} CT
                  </span>
                </summary>
                <p className="mt-2 text-xs text-muted">
                  First seen {when(r.first_seen)} CT
                </p>
                {r.stack && (
                  <pre className="mono mt-2 overflow-x-auto text-xs whitespace-pre-wrap text-muted">
                    {r.stack}
                  </pre>
                )}
              </details>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
