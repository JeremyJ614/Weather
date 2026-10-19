import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { Message, type Msg } from "./Message";

export const metadata: Metadata = {
  title: "Contact inbox · Admin · StormSync Media",
};

/** Messages from every form in the app (VIP #32). Kept one year. */
export default async function Inbox() {
  const { supabase } = await requireAdmin("inbox");
  const { data } = await supabase
    .from("contact_messages")
    .select("id, form, name, email, subject, body, read, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as Msg[];
  const unread = rows.filter((m) => !m.read).length;
  return (
    <main className="mx-auto max-w-2xl px-4 pt-6 pb-24">
      <h1 className="display text-3xl text-accent">Contact inbox</h1>
      <p className="mt-1 text-sm text-muted">
        {unread} unread of {rows.length}. Every form that writes to the team
        lands here, tagged with the form it came from (edit the Contact Us forms
        in Contact forms). Messages are kept for a year.
      </p>
      {!rows.length ? (
        <p className="mt-6 text-muted">No messages yet.</p>
      ) : (
        <ul className="mt-6 grid gap-2">
          {rows.map((m) => (
            <Message key={m.id} m={m} />
          ))}
        </ul>
      )}
    </main>
  );
}
