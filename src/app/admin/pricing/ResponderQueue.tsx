import { getResponders } from "@/lib/billing/perks";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { reviewResponder } from "./actions";

/**
 * Post-launch A4: spotter and first-responder discount requests, newest first, with the
 * photo they sent (a link that works for 10 minutes). Approving applies the discount at
 * their next checkout and tells them.
 */
export async function ResponderQueue() {
  const { list } = await getResponders().catch(() => ({ list: [] }));
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => b.at.localeCompare(a.at));
  const store = supabaseAdmin().storage.from("ops");
  const photos = await Promise.all(
    sorted.map((r) =>
      r.photo && r.status === "pending"
        ? store
            .createSignedUrl(r.photo, 600)
            .then((x) => x.data?.signedUrl ?? null)
            .catch(() => null)
        : null,
    ),
  );
  return (
    <section className="grid gap-2">
      <h2 className="display text-xl text-accent">Responder requests</h2>
      <ul className="grid gap-2">
        {sorted.map((r, i) => (
          <li
            key={r.user}
            className="grid gap-2 rounded-2xl border border-line bg-surface p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <b>{r.name}</b>
              <small className="text-muted">
                {new Date(r.at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {r.status}
              </small>
            </div>
            <p className="text-sm text-muted">
              {r.role} · {r.agency} · {r.email}
            </p>
            {photos[i] && (
              <a
                href={photos[i]!}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-accent underline"
              >
                Open the photo they sent
              </a>
            )}
            {r.status === "pending" && (
              <div className="flex gap-2">
                <form action={reviewResponder}>
                  <input type="hidden" name="user" value={r.user} />
                  <input type="hidden" name="status" value="approved" />
                  <button className="btn-dark rounded-full border border-accent/40 px-4 py-2 text-sm text-accent">
                    Approve
                  </button>
                </form>
                <form action={reviewResponder}>
                  <input type="hidden" name="user" value={r.user} />
                  <input type="hidden" name="status" value="declined" />
                  <button className="btn-dark rounded-full border border-line px-4 py-2 text-sm">
                    Decline
                  </button>
                </form>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
