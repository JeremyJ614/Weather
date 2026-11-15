#!/usr/bin/env node
/**
 * Smoke test (post-launch A1, "ci-back"): opens the guest front door of a running build in a
 * real browser and fails on a bad status, a page crash or a missing heading. Catches what
 * typecheck can't: blank pages, hydration crashes, broken routes.
 *   BASE_URL=http://localhost:3000 node scripts/smoke.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const PAGES = [
  "/",
  "/sswxcon",
  "/spc-probability",
  "/on-this-day",
  "/weather-glossary",
  "/free-content-library",
  "/faq",
  "/join",
  "/privacy",
];
const FILES = [
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  "/feed.xml",
  "/manifest.webmanifest",
];

async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(BASE + "/robots.txt");
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`No server answered at ${BASE} within 90 s`);
}

await waitForServer();
const failures = [];
for (const path of FILES) {
  const r = await fetch(BASE + path);
  if (!r.ok) failures.push(`${path}: HTTP ${r.status}`);
  else console.log(`ok  ${path}`);
}
const browser = await chromium.launch();
for (const path of PAGES) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const crashes = [];
  page.on("pageerror", (e) => crashes.push(e.message));
  try {
    const res = await page.goto(BASE + path, {
      waitUntil: "load",
      timeout: 60_000,
    });
    const status = res?.status() ?? 0;
    if (status >= 400) failures.push(`${path}: HTTP ${status}`);
    await page.waitForTimeout(1500);
    const heading = await page
      .locator("h1")
      .first()
      .isVisible()
      .catch(() => false);
    if (!heading) failures.push(`${path}: no visible heading`);
    if (crashes.length)
      failures.push(`${path}: ${crashes.join(" | ").slice(0, 300)}`);
    if (status < 400 && heading && !crashes.length) console.log(`ok  ${path}`);
  } catch (e) {
    failures.push(`${path}: ${e.message.split("\n")[0]}`);
  }
  await page.close();
}
await browser.close();
if (failures.length) {
  console.error(
    `\nSmoke test failed on ${failures.length} check(s):\n  ${failures.join("\n  ")}`,
  );
  process.exit(1);
}
console.log(
  `\nSmoke test passed: ${PAGES.length} pages, ${FILES.length} files.`,
);
