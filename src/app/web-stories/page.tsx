import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { pageMeta } from "@/lib/seo/site";
import { allStories } from "@/lib/stories/build";
import s from "./Stories.module.css";

export const revalidate = 900;
export const metadata: Metadata = pageMeta(
  "/web-stories",
  "Web Stories",
  "Tap-through stories of America's most famous tornadoes and today's biggest storms.",
);

/** Every Web Story (B8): today's big severe day when there is one, then the Tornado Archive. */
export default async function WebStories() {
  const list = await allStories();
  return (
    <main className="grid gap-4 pb-10">
      <PageHero
        eyebrow={["Stories", `${list.length} to tap through`]}
        title="Web Stories"
        subtitle="The biggest storms in a minute each: tracks, the story and the numbers. Tap a cover to start."
      />
      <ol className={s.grid}>
        {list.map((st) => (
          <li key={st.id}>
            {/* An AMP page outside the app: a plain link, not client navigation. */}
            <a href={`/web-stories/${st.id}`} className={s.card}>
              {/* eslint-disable-next-line @next/next/no-img-element -- generated story poster */}
              <img
                src={st.poster.replace(/^https:\/\/[^/]+/, "")}
                alt=""
                width={320}
                height={427}
                loading="lazy"
              />
              <span>
                <b>{st.title}</b>
                <small>{st.description}</small>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </main>
  );
}
