import Link from "next/link";
import { NavIcon } from "@/components/NavIcon";
import { href, type NavGroup } from "@/lib/nav/registry";

/** A group's pages as links, with the shared active-page marking. */
export function Items({
  group,
  path,
  className,
  iconClass = "size-4 text-accent",
  tabbable = true,
}: {
  group: NavGroup;
  path: string;
  className: string;
  iconClass?: string;
  tabbable?: boolean;
}) {
  return (
    <>
      {group.pages.map((pg, i) => (
        <Link
          key={pg.slug}
          href={href(pg)}
          className={className}
          style={{ ["--i" as string]: i }}
          tabIndex={tabbable ? 0 : -1}
          aria-current={path === href(pg) ? "page" : undefined}
        >
          <NavIcon name={pg.icon} className={iconClass} />
          <span>{pg.label}</span>
        </Link>
      ))}
    </>
  );
}

export const single = (g: NavGroup) =>
  g.pages.length === 1 ? g.pages[0] : null;
