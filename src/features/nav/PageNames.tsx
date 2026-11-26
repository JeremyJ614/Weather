"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * The owner's page renames (admin → Menu editor) for every page header, not only the menus
 * (owner's list #41: "Atmospheric Parameters" still said "Atmospheric Ingredients"). The root
 * layout passes the renamed labels by slug; a header shows its page's new name when it has
 * one, and the browser tab follows.
 */
const Names = createContext<Record<string, string>>({});

export function PageNames({
  names,
  children,
}: {
  names: Record<string, string>;
  children: ReactNode;
}) {
  return <Names.Provider value={names}>{children}</Names.Provider>;
}

/** This page's renamed label, or `fallback` when the owner hasn't renamed it. */
export function usePageName(fallback: string) {
  const names = useContext(Names);
  const slug = (usePathname() ?? "/").split("/")[1] ?? "";
  return names[slug] || fallback;
}

export function HeroTitle({ title }: { title: string }) {
  const name = usePageName(title);
  useEffect(() => {
    if (name !== title && document.title.includes(title))
      document.title = document.title.replace(title, name);
  }, [name, title]);
  return <>{name}</>;
}
