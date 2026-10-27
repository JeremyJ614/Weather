import { nationalScore } from "@/lib/sswxcon/live";
import { OG_SIZE, OG_TYPE, ogCard } from "@/lib/seo/og";

export const alt = "The SSWXCon Score: how stormy the country is right now";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const revalidate = 900;

/** The share image carries the live score, so a shared link says how stormy it is. */
export default async function Image() {
  const n = await nationalScore().catch(() => null);
  return ogCard({
    eyebrow: "SSWXCon Score · right now",
    title: n ? `${n.total} · ${n.band.label}` : "How stormy is it?",
    sub: "How stormy the whole country is on one 0–250 scale, from live warnings, reports, outlooks and radar.",
  });
}
