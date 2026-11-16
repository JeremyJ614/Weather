import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { newsbreakDrafts } from "@/lib/newsbreak/drafts";
import { Copy } from "./Copy";
import s from "./NewsBreak.module.css";

export const metadata: Metadata = {
  title: "NewsBreak posts · Admin · StormSync Media",
};
export const dynamic = "force-dynamic";

/**
 * NewsBreak Creator Program (post-launch A10, B9): how to apply, and today's ready-to-post
 * drafts (a storm-day explainer and town forecasts) built from live SPC and NWS data.
 */
export default async function NewsBreakAdmin() {
  await requireAdmin("news");
  const d = await newsbreakDrafts().catch(() => null);
  return (
    <div className={s.wrap}>
      <header>
        <h1>NewsBreak posts</h1>
        <p>
          NewsBreak is the largest local news app in the U.S. Approved creators
          post local stories and get paid for views; ours are storm-day
          explainers and town forecasts, each linking back to the app.
        </p>
      </header>
      <section className={s.card}>
        <h2>Apply once</h2>
        <ol>
          <li>
            Open creators.newsbreak.com and sign up as a creator for StormSync
            Media (U.S.-based, local weather).
          </li>
          <li>
            For the sample content, paste two or three of the drafts below (the
            explainer reads best).
          </li>
          <li>
            Once approved, post the day&apos;s drafts on storm days; they change
            every 30 minutes with the outlook.
          </li>
        </ol>
      </section>
      <section className={s.card}>
        <h2>Today&apos;s drafts</h2>
        {!d && (
          <p className={s.muted}>
            The outlook isn&apos;t answering right now. Try again in a few
            minutes.
          </p>
        )}
        {d && !d.drafts.length && (
          <p className={s.muted}>
            No Slight risk or higher on today&apos;s SPC outlook, so
            there&apos;s nothing worth posting. Drafts appear here by themselves
            on storm days.
          </p>
        )}
        {d?.drafts.map((x) => (
          <article key={x.title} className={s.draft}>
            <small>
              {x.kind === "explainer"
                ? `Storm-day explainer · ${d.risk}`
                : `Town forecast · ${x.town}`}
            </small>
            <h3>{x.title}</h3>
            <p>{x.body}</p>
            <Copy text={`${x.title}\n\n${x.body}`} />
          </article>
        ))}
      </section>
    </div>
  );
}
