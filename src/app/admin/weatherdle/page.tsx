import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { gameDate } from "@/lib/game/score";
import { WeatherdleAdmin, type Row } from "./WeatherdleAdmin";

export const metadata: Metadata = {
  title: "Weatherdle · Admin · StormSync Media",
};

/** Final List #5: Weatherdle's hints switch and any word for any day. */
export default async function WeatherdleAdminPage() {
  const { supabase } = await requireAdmin("weatherdle");
  const today = gameDate();
  const from = new Date(Date.parse(`${today}T12:00:00Z`) - 14 * 86400_000)
    .toISOString()
    .slice(0, 10);
  const [{ data: settings }, { data: words }, { data: plays }] =
    await Promise.all([
      supabase
        .from("app_config")
        .select("value")
        .eq("key", "weatherdle_settings")
        .maybeSingle(),
      supabase
        .from("weatherdle_words")
        .select("day, word, hint, source")
        .gte("day", from)
        .order("day", { ascending: false })
        .limit(60),
      supabase
        .from("weatherdle_plays")
        .select("day, solved")
        .gte("day", from)
        .limit(5000),
    ]);
  const count = new Map<string, { played: number; solved: number }>();
  for (const p of (plays ?? []) as { day: string; solved: boolean }[]) {
    const c = count.get(p.day) ?? { played: 0, solved: 0 };
    c.played++;
    if (p.solved) c.solved++;
    count.set(p.day, c);
  }
  const rows: Row[] = ((words ?? []) as Omit<Row, "played" | "solved">[]).map(
    (w) => ({ ...w, ...(count.get(w.day) ?? { played: 0, solved: 0 }) }),
  );
  const hints =
    (settings?.value as { hints?: boolean } | null)?.hints !== false;
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 pt-6 pb-24">
      <h1 className="display text-3xl text-accent">Weatherdle</h1>
      <p className="text-sm text-muted">
        A new weather word every day at midnight Eastern, any length from 3 to
        14 letters. The AI picks one (never a word used in the past year) unless
        you set your own here for that day. Today&apos;s word can be changed
        until someone plays it.
      </p>
      <WeatherdleAdmin today={today} hints={hints} rows={rows} />
    </main>
  );
}
