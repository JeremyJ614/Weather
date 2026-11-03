// Stamps each build (Fix list 2026-10-30 #1): public/version.json holds the stamp, and
// next.config.ts bakes the same stamp into the app, so an open page can tell a new version
// has shipped and reload itself onto it. Runs before dev and build.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const sha = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7);
const id =
  process.env.NODE_ENV === "development" || process.argv.includes("--dev")
    ? "dev"
    : `${sha || "local"}-${Date.now().toString(36)}`;
writeFileSync(
  join(import.meta.dirname, "..", "public", "version.json"),
  JSON.stringify({ id }) + "\n",
);
console.log(`Build stamp ${id} written to public/version.json`);
