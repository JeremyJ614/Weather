import Link from "next/link";
import { Siren, Tornado, Database } from "lucide-react";
import s from "@/features/news/HomeTabs.module.css";

/**
 * A county page sits inside Severe Weather History's third tab (owner, 2026-11-26): the same tab
 * row as the page, as links back to each tab, with Tornado Database lit.
 */
export function TabLinks() {
  const tabs = [
    [
      "/severe-weather-history",
      "Tornado Tracks",
      <Tornado key="t" aria-hidden />,
    ],
    [
      "/severe-weather-history#h-warn",
      "Warnings",
      <Siren key="w" aria-hidden />,
    ],
    [
      "/severe-weather-history#tornado-database",
      "Tornado Database",
      <Database key="d" aria-hidden />,
    ],
  ] as const;
  return (
    <nav
      aria-label="Severe Weather History"
      className={s.underline}
      style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 16 }}
    >
      <span
        aria-hidden
        className={s.rule}
        style={{ width: "33.333%", transform: "translateX(200%)" }}
      />
      {tabs.map(([href, label, icon], i) => (
        <Link
          key={href}
          href={href}
          className={s.tab}
          aria-current={i === 2 ? "page" : undefined}
          style={{
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            color: i === 2 ? "var(--accent)" : undefined,
          }}
        >
          {icon}
          {label}
        </Link>
      ))}
    </nav>
  );
}
