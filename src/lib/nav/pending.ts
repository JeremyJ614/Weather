import { existsSync } from "node:fs";
import { join } from "node:path";
import { ALL_PAGES } from "./registry";

/**
 * Registry pages that have no route of their own yet: the only ones `[slug]` may answer with
 * a phase notice. Read from the app folder at build time, so a page that gets its own route
 * can never be shadowed by a prerendered notice (Fix-It #7: Profile, Settings, Notifications
 * and Storm Chasing Outlook were, because a hand-kept list had fallen behind).
 */
export function pendingPages(root = join(process.cwd(), "src", "app")) {
  return ALL_PAGES.filter(
    (p) => p.slug && !existsSync(join(root, p.slug, "page.tsx")),
  );
}
