import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { removeRelease } from "./actions";
import { ReleaseForm } from "./ReleaseForm";

export const metadata: Metadata = {
  title: "Releases · Admin · StormSync Media",
};

export default async function Releases() {
  const { supabase } = await requireAdmin("news");
  const { data: rows } = await supabase
    .from("app_releases")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(50);
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 pt-6 pb-24">
      <h1 className="display text-3xl text-accent">Releases</h1>
      <ReleaseForm />
      <ul className="grid gap-2">
        {(rows ?? []).map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2"
          >
            <span>
              <b className="text-accent">v{r.version}</b> {r.title}
              <span className="block text-xs text-muted">
                {new Date(r.published_at).toLocaleDateString("en-US")}
              </span>
            </span>
            <form action={removeRelease}>
              <input type="hidden" name="id" value={r.id} />
              <button
                type="submit"
                aria-label={`Remove v${r.version}`}
                className="grid size-9 place-items-center rounded-lg border border-line text-accent"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
