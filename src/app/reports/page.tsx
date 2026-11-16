import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/ui/PageHero";
import { pageMeta } from "@/lib/seo/site";
import s from "./Report.module.css";

export const metadata: Metadata = pageMeta(
  "/reports",
  "Data reports",
  "Free weather data reports from StormSync Weather, made to be cited.",
);

const REPORTS = [
  {
    href: "/reports/tornado-season-2026",
    title: "The 2026 tornado season in numbers",
    sub: "Reports by month and state, the busiest days, and 75 years for comparison. Updated daily.",
  },
];

/** Data reports (B8): short, chart-led and free to cite. */
export default function Reports() {
  return (
    <main className="grid gap-4 pb-10">
      <PageHero
        eyebrow={["Free to cite"]}
        title="Data reports"
        subtitle="Numbers nobody else puts together, ready for reporters, teachers and bloggers."
      />
      <div className={s.list}>
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href}>
            <b>{r.title}</b>
            <small>{r.sub}</small>
          </Link>
        ))}
      </div>
    </main>
  );
}
