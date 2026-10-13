import { Rocket, UserPlus } from "lucide-react";
import { NewsBody } from "@/lib/news/markdown";
import { getAppUpdates } from "@/lib/news/updates";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** App Updates tab: releases and new members (initials only). Game winners join in phase 26. */
export async function AppUpdates() {
  const { releases, members } = await getAppUpdates();
  if (!releases.length && !members.length) {
    return (
      <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
        No updates yet.
      </p>
    );
  }
  return (
    <div className="grid gap-6">
      {members.length > 0 && (
        <section className="grid gap-2">
          <h2 className="flex items-center gap-2 font-bold text-accent">
            <UserPlus className="size-4" aria-hidden /> New members
          </h2>
          <ul className="flex flex-wrap gap-2">
            {members.map((m, i) => (
              <li
                key={i}
                className="rounded-full border border-line bg-surface px-3 py-1 text-sm"
              >
                <b>{m.initials}</b>{" "}
                <span className="text-muted">· {day(m.joined)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {releases.length > 0 && (
        <section className="grid gap-3">
          <h2 className="flex items-center gap-2 font-bold text-accent">
            <Rocket className="size-4" aria-hidden /> Releases
          </h2>
          {releases.map((r) => (
            <article
              key={r.id}
              className="grid gap-2 rounded-2xl border border-line bg-surface p-4"
            >
              <p className="mono text-xs text-muted">
                v{r.version} · {day(r.published_at)}
              </p>
              <h3 className="font-bold">{r.title}</h3>
              {r.notes && <NewsBody source={r.notes} />}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
