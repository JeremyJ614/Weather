#!/usr/bin/env node
/* Writes docs/10-POST-LAUNCH.md from the lab's data files (the lab is the source of truth). */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const ctx = { window: {} };
vm.createContext(ctx);
const files = readdirSync(join(here, "data")).filter((f) => /^[a-c]\d+\.js$/.test(f));
files.sort((a, b) => a[0].localeCompare(b[0]) || parseInt(a.slice(1)) - parseInt(b.slice(1)));
for (const f of files) vm.runInContext(readFileSync(join(here, "data", f), "utf8"), ctx);
const PL = ctx.window.PL;

const out = [
  "# Post-launch list (2026-11-15)",
  "",
  "Generated from `design-lab/post-launch/data/` by `node design-lab/post-launch/build-md.mjs`. The owner picks in the Post-Launch Lab (artifact db doc `postlaunch/picks`); nothing here is built until picked.",
  "",
];
const line = (k, v) => (v === undefined || v === "" ? [] : [`- ${k}: ${v}`]);
for (const key of Object.keys(PL)) {
  const s = PL[key];
  out.push(`## ${key.toUpperCase()}. ${s.title}`, "", s.intro, "");
  for (const [i, it] of (s.items || []).entries()) {
    out.push(`### ${key.toUpperCase()}.${i + 1} ${it.title}${it.tag ? ` (${it.tag})` : ""}`, "");
    if (it.what) out.push(it.what, "");
    if (it.how) out.push(`How: ${it.how}`, "");
    if (it.pros?.length) out.push(`- Pros: ${it.pros.join("; ")}`);
    if (it.cons?.length) out.push(`- Cons: ${it.cons.join("; ")}`);
    if (it.needs) out.push(...line("Needs", it.needs));
    if (it.upgrades?.length) {
      out.push("- Upgrades:");
      for (const u of it.upgrades) out.push(`  - **${u.title}**: ${u.what}${u.gain ? ` (accuracy gain: ${u.gain})` : ""}`);
    }
    out.push(
      ...line("Data", it.data),
      ...line("Effort", it.effort),
      ...line("Impact", it.score !== undefined ? `${it.score}/10` : it.impact !== undefined ? `${it.impact}/5` : undefined),
      ...line("Eligible", it.eligible),
    );
    out.push("");
  }
}
writeFileSync(join(here, "../../docs/10-POST-LAUNCH.md"), out.join("\n"));
console.log("wrote docs/10-POST-LAUNCH.md:", Object.keys(PL).join(", "));
