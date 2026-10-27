import { readDay, todayMd } from "@/lib/history/days";
import { dateName } from "@/lib/history/story";
import { OG_SIZE, OG_TYPE, ogCard } from "@/lib/seo/og";

export const alt = "On This Day in weather history";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const revalidate = 3600;

/** Today's story's title on the share image. */
export default async function Image() {
  const md = todayMd();
  const day = await readDay(md).catch(() => null);
  const story = day?.story && "title" in day.story ? day.story : null;
  return ogCard({
    eyebrow: `On this day · ${dateName(md)}`,
    title: story?.title ?? "A storm that made its mark on this date",
    sub: "One famous storm from today's date in history, told like a story, with its tracks on the map.",
  });
}
