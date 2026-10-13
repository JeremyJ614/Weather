#!/usr/bin/env node
/**
 * Performance budget gate (B4).
 *
 * Measures the gzipped JavaScript each route ships and fails the build when a
 * route exceeds budget. This runs in CI as a gate, not as advice: on a mid-tier
 * Android the JS payload is paid twice — once to download and again, far more
 * expensively, to parse and hydrate. A budget that only warns gets ignored.
 *
 * Next 16 builds with Turbopack, which does not emit the classic
 * `app-build-manifest.json` route→chunk map. The mapping is recovered instead
 * from each route's RSC client-reference manifest, which lists exactly the
 * client chunks that route pulls in.
 *
 * Reported per route:
 *   shared  — the framework baseline every route pays
 *   common  — chunks several routes pull in via shared client components
 *             (navigation, theme). Not framework, but
 *             not this route's doing either; broken out because a route that
 *             looks expensive is usually paying for the shell, and optimising
 *             the wrong thing is the cost of not knowing that.
 *   route   — chunks only this route pulls in
 *   total   — what a modern browser downloads for a cold visit
 *
 * The budget is applied to `total` and to nothing else. The tiers exist to say
 * where the weight is, not to excuse any of it.
 *
 * Polyfills are measured but deliberately NOT budgeted. Next emits them with
 * `nomodule`, so every browser this platform targets skips the download
 * entirely. Charging a route ~38 kB it will never fetch would either force
 * pointless optimisation work or push the budget up to hide real regressions.
 *
 * Usage: node scripts/perf-budget.mjs [--json]
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { gzip } from "node:zlib";
import { promisify } from "node:util";
import path from "node:path";

const gzipAsync = promisify(gzip);

const ROOT = process.cwd();
const NEXT_DIR = path.join(ROOT, ".next");
const APP_DIR = path.join(NEXT_DIR, "server", "app");

/** Total gzipped JS a cold visit to any single route may cost. */
const BUDGET_BYTES = 170 * 1024;

const asJson = process.argv.includes("--json");
const sizeCache = new Map();

async function gzippedSize(relativePath) {
  const clean = relativePath.replace(/^\/_next\//, "").replace(/^\//, "");
  if (sizeCache.has(clean)) return sizeCache.get(clean);

  const absolute = path.join(NEXT_DIR, clean);
  let size = 0;

  if (existsSync(absolute)) {
    const info = await stat(absolute);
    if (info.isFile()) {
      const compressed = await gzipAsync(await readFile(absolute), { level: 9 });
      size = compressed.length;
    }
  }

  sizeCache.set(clean, size);
  return size;
}

async function sumUnique(files) {
  let total = 0;
  for (const file of new Set(files)) {
    total += await gzippedSize(file);
  }
  return total;
}

/** Chunks loaded on every route: framework runtime, plus legacy polyfills. */
async function readSharedFiles() {
  const manifestPath = path.join(NEXT_DIR, "build-manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      "No build manifest found. Run `next build` before the budget check.",
    );
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const isJs = (file) => file.endsWith(".js");

  return {
    shared: (manifest.rootMainFiles ?? []).filter(isJs),
    polyfills: (manifest.polyfillFiles ?? []).filter(isJs),
  };
}

/** Walks .next/server/app for every `page_client-reference-manifest.js`. */
async function findRouteManifests(dir, found = []) {
  if (!existsSync(dir)) return found;

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await findRouteManifests(full, found);
    } else if (entry.name === "page_client-reference-manifest.js") {
      found.push(full);
    }
  }
  return found;
}

function routeNameFromManifest(manifestPath) {
  const relative = path
    .relative(APP_DIR, manifestPath)
    .replace(/page_client-reference-manifest\.js$/, "")
    .replace(/\\/g, "/")
    .replace(/\/$/, "");

  return relative === "" ? "/" : `/${relative}`;
}

async function main() {
  const { shared: sharedFiles, polyfills } = await readSharedFiles();
  const sharedBytes = await sumUnique(sharedFiles);
  const polyfillBytes = await sumUnique(polyfills);

  const manifests = await findRouteManifests(APP_DIR);
  if (manifests.length === 0) {
    console.error(
      "Budget check found no route manifests under .next/server/app.",
    );
    process.exit(1);
  }

  const results = [];
  const routeChunks = new Map();

  for (const manifestPath of manifests) {
    const source = await readFile(manifestPath, "utf8");
    const referenced = new Set(
      source.match(/static\/chunks\/[A-Za-z0-9_.\-/]+\.js/g) ?? [],
    );

    // Anything already in the shared baseline is not charged twice.
    for (const file of sharedFiles) referenced.delete(file);
    for (const file of polyfills) referenced.delete(file);

    routeChunks.set(routeNameFromManifest(manifestPath), referenced);
  }

  // A chunk pulled in by more than one route comes from a shared client
  // component rather than from the route itself.
  const chunkUseCount = new Map();
  for (const referenced of routeChunks.values()) {
    for (const chunk of referenced) {
      chunkUseCount.set(chunk, (chunkUseCount.get(chunk) ?? 0) + 1);
    }
  }

  for (const [route, referenced] of routeChunks) {
    const common = [...referenced].filter(
      (chunk) => (chunkUseCount.get(chunk) ?? 0) > 1,
    );
    const own = [...referenced].filter(
      (chunk) => (chunkUseCount.get(chunk) ?? 0) === 1,
    );

    const commonBytes = await sumUnique(common);
    const routeBytes = await sumUnique(own);

    results.push({
      route,
      sharedBytes,
      commonBytes,
      routeBytes,
      totalBytes: sharedBytes + commonBytes + routeBytes,
      chunks: referenced.size,
    });
  }

  results.sort((a, b) => b.totalBytes - a.totalBytes);
  const failures = results.filter((entry) => entry.totalBytes > BUDGET_BYTES);

  if (asJson) {
    console.log(
      JSON.stringify(
        { budget: BUDGET_BYTES, sharedBytes, polyfillBytes, results },
        null,
        2,
      ),
    );
  } else {
    const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
    console.log(`\nRoute JavaScript, gzipped — budget ${kb(BUDGET_BYTES)}`);
    console.log(`Shared baseline: ${kb(sharedBytes)}`);
    console.log(
      `Legacy polyfills: ${kb(polyfillBytes)} (nomodule — not budgeted)\n`,
    );
    console.log("  status     total    common     route  usage  path");

    for (const entry of results) {
      const marker = entry.totalBytes > BUDGET_BYTES ? "FAIL" : "ok  ";
      const pct = `${((entry.totalBytes / BUDGET_BYTES) * 100).toFixed(0)}%`;
      console.log(
        `  ${marker}  ${kb(entry.totalBytes).padStart(9)}  ${kb(entry.commonBytes).padStart(8)}  ${kb(entry.routeBytes).padStart(8)}  ${pct.padStart(5)}  ${entry.route}`,
      );
    }
    console.log("");
  }

  if (failures.length > 0) {
    console.error(
      `Performance budget exceeded on ${failures.length} route(s):\n` +
        failures.map((f) => `  ${f.route}`).join("\n") +
        `\n\nSplit the route, dynamically import the heavy module, or move the ` +
        `work to a server component.`,
    );
    process.exit(1);
  }

  console.log("Performance budget: PASS");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
