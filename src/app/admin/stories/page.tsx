import type { Metadata } from "next";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pin, PinOff } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { rank, type Story } from "@/lib/news/feed";
import { curateStory } from "./actions";
import { Refresh } from "./Refresh";

export const metadata: Metadata = {
  title: "Homepage stories · Admin · StormSync Media",
};

function Op({
  url,
  op,
  label,
  children,
}: {
  url: string;
  op: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <form action={curateStory}>
      <input type="hidden" name="url" value={url} />
      <input type="hidden" name="op" value={op} />
      <button
        type="submit"
        aria-label={label}
        title={label}
        className="grid size-9 place-items-center rounded-lg border border-line bg-bg text-accent"
      >
        {children}
      </button>
    </form>
  );
}

export default async function Stories() {
  const { supabase } = await requireAdmin("news");
  const [{ data: items }, { data: cur }] = await Promise.all([
    supabase.from("weather_news_items").select("*"),
    supabase.from("news_curation").select("url, action, position"),
  ]);
  const state = new Map((cur ?? []).map((c) => [c.url, c]));
  const pins = (cur ?? [])
    .filter((c) => c.action === "pin")
    .sort((a, b) => a.position - b.position)
    .map((c) => c.url);
  const ranked = rank((items ?? []) as Story[], 40, 40);
  const ordered = [
    ...pins.flatMap((u) => ranked.filter((s) => s.url === u)),
    ...ranked.filter((s) => !pins.includes(s.url)),
  ];
  let shown = 0;

  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 pt-6 pb-24">
      <div>
        <h1 className="display text-3xl text-accent">Homepage stories</h1>
        <p className="mt-1 text-sm text-muted">
          Collected daily at 7 AM Eastern, most severe first. Pin to keep a
          story at the top, hide to drop it. The first 15 visible stories appear
          on the homepage.
        </p>
      </div>
      <Refresh />
      {!ordered.length && (
        <p className="text-muted">Nothing collected yet. Use “Collect now”.</p>
      )}
      <ol className="grid gap-2">
        {ordered.map((s) => {
          const c = state.get(s.url);
          const hidden = c?.action === "hide";
          const pinned = c?.action === "pin";
          const onHome = !hidden && ++shown <= 15;
          return (
            <li
              key={s.url}
              className={`grid gap-2 rounded-xl border bg-surface p-3 ${hidden ? "border-line opacity-50" : pinned ? "border-accent" : "border-line"}`}
            >
              <span className="text-xs text-muted">
                <b className="text-accent">{s.source}</b> · severity{" "}
                {s.severity}
                {onHome
                  ? " · on homepage"
                  : hidden
                    ? " · hidden"
                    : " · below the top 15"}
              </span>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold"
              >
                {s.title}
              </a>
              <div className="flex gap-1.5">
                {pinned ? (
                  <>
                    <Op url={s.url} op="unpin" label="Unpin">
                      <PinOff className="size-4" aria-hidden />
                    </Op>
                    <Op url={s.url} op="up" label="Move up">
                      <ArrowUp className="size-4" aria-hidden />
                    </Op>
                    <Op url={s.url} op="down" label="Move down">
                      <ArrowDown className="size-4" aria-hidden />
                    </Op>
                  </>
                ) : hidden ? (
                  <Op url={s.url} op="unhide" label="Show again">
                    <Eye className="size-4" aria-hidden />
                  </Op>
                ) : (
                  <>
                    <Op url={s.url} op="pin" label="Pin to top">
                      <Pin className="size-4" aria-hidden />
                    </Op>
                    <Op url={s.url} op="hide" label="Hide">
                      <EyeOff className="size-4" aria-hidden />
                    </Op>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
