import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { NoticeForm } from "./NoticeForm";
import { removeNotice } from "./actions";

export const metadata: Metadata = {
  title: "Send notification · Admin · StormSync Media",
};

const TONE: Record<string, string> = {
  info: "text-muted",
  warning: "text-[#fbbf24]",
  alert: "text-[#f87171]",
};

/** In-app notices (VIP #31): a pop-up for every member or one, plus what was sent. */
export default async function Notify() {
  const { supabase } = await requireAdmin("notify");
  const [{ data: sent }, { data: members }, { data: reads }] =
    await Promise.all([
      supabase
        .from("notifications")
        .select("id, user_id, level, title, body, created_at")
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .order("first_name"),
      supabase.from("notification_reads").select("notification_id"),
    ]);
  const name = new Map(
    (members ?? []).map((m) => [m.id, `${m.first_name} ${m.last_name}`]),
  );
  const seen = new Map<string, number>();
  for (const r of reads ?? [])
    seen.set(r.notification_id, (seen.get(r.notification_id) ?? 0) + 1);
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 pt-6 pb-24">
      <div>
        <h1 className="display text-3xl text-accent">Send notification</h1>
        <p className="mt-1 text-sm text-muted">
          Pops up the next time members open the app, until they close it. Only
          members who joined before it was sent see it. Kept 90 days.
        </p>
      </div>
      <NoticeForm members={[...name].map(([id, n]) => ({ id, name: n }))} />
      <h2 className="font-bold">Sent</h2>
      {!sent?.length ? (
        <p className="text-muted">Nothing sent yet.</p>
      ) : (
        <ul className="grid gap-2">
          {sent.map((n) => (
            <li
              key={n.id}
              className="rounded-2xl border border-line bg-surface p-3"
            >
              <p className="flex items-baseline gap-2">
                <span
                  className={`text-[10px] font-bold tracking-wider uppercase ${TONE[n.level]}`}
                >
                  {n.level}
                </span>
                <b className="min-w-0 truncate">{n.title}</b>
              </p>
              {n.body && <p className="mt-1 text-sm text-muted">{n.body}</p>}
              <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                To{" "}
                {n.user_id
                  ? (name.get(n.user_id) ?? "a removed member")
                  : "everyone"}{" "}
                ·{" "}
                {new Date(n.created_at).toLocaleString("en-US", {
                  timeZone: "America/Chicago",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                CT · seen by {seen.get(n.id) ?? 0}
                <form
                  action={removeNotice.bind(null, n.id)}
                  className="ml-auto"
                >
                  <button type="submit" className="underline">
                    Remove
                  </button>
                </form>
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
