import Link from "@/components/IntentLink";
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

export type Entry = {
  key: string;
  label: string;
  icon: string;
  /** A page to open, or null for a section to drill into. */
  to: string | null;
};

/** What a drill-down menu shows: every section (one-page sections open straight away), or one section's pages. */
export function entries(groups: NavGroup[], sel?: NavGroup): Entry[] {
  return sel
    ? sel.pages.map((pg) => ({
        key: pg.slug,
        label: pg.label,
        icon: pg.icon,
        to: href(pg),
      }))
    : groups.map((g) => {
        const one = single(g);
        return {
          key: g.id,
          label: one?.label ?? g.label,
          icon: one?.icon ?? g.icon,
          to: one ? href(one) : null,
        };
      });
}
