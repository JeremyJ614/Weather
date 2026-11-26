/**
 * The Supabase project move (owner, 2026-11-26; docs/12-SUPABASE-MOVE.md): reads everything the
 * live project holds through the site's jobs relay (the only way in without the lost login) and
 * writes it to ./export for the workflow to seal with the move's public key:
 *
 *   schema.json   the REST API's description of every table, column and function
 *   tables/*.json every row of every table, paged by primary key
 *   buckets.json  and storage/<bucket>/<path>: every Storage file
 *   users.json    every member account (ids, emails, names, sign-in providers; never passwords)
 *   manifest.json counts, for the import to check against
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { actionsToken } from "../../src/lib/jobs/oidc";

const RELAY =
  process.env.JOBS_RELAY ?? "https://weather.sswx.space/api/jobs/sb";
const OUT = path.resolve("export");
const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

async function call(p: string, init: RequestInit = {}) {
  let last = "";
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${RELAY}/${p}`, {
      ...init,
      headers: {
        authorization: `Bearer ${await actionsToken()}`,
        ...(init.headers as Record<string, string>),
      },
      signal: AbortSignal.timeout(60_000),
    }).catch((e: Error) => {
      last = e.message;
      return null;
    });
    if (r && r.status < 500) return r;
    if (r) last = `${r.status} ${(await r.text()).slice(0, 200)}`;
    await wait(2000 * (i + 1));
  }
  throw new Error(`${p}: ${last}`);
}

type Def = {
  properties?: Record<string, { description?: string }>;
};

async function tables(manifest: Record<string, unknown>) {
  const r = await call("rest/v1/", {
    headers: { accept: "application/openapi+json" },
  });
  if (!r.ok) throw new Error(`schema ${r.status}`);
  const schema = (await r.json()) as {
    definitions: Record<string, Def>;
    paths: Record<string, unknown>;
  };
  await writeFile(path.join(OUT, "schema.json"), JSON.stringify(schema));
  await mkdir(path.join(OUT, "tables"), { recursive: true });
  const counts: Record<string, number | string> = {};
  for (const [t, def] of Object.entries(schema.definitions)) {
    if (!schema.paths[`/${t}`]) continue;
    const cols = Object.entries(def.properties ?? {});
    const pk = cols
      .filter(([, c]) => c.description?.includes("<pk/>"))
      .map(([k]) => k);
    const order = (pk.length ? pk : cols.slice(0, 1).map(([k]) => k))
      .map((k) => `${k}.asc`)
      .join(",");
    const rows: unknown[] = [];
    let size = 1000;
    for (let from = 0; ;) {
      const q = `rest/v1/${encodeURIComponent(t)}?select=*${order ? `&order=${order}` : ""}&offset=${from}&limit=${size}`;
      const res = await call(q, {
        headers: { accept: "application/json" },
      }).catch(() => null);
      if (!res || !res.ok) {
        // A page too big for the relay (wide rows of map data): smaller pages.
        if (size > 1) {
          size = Math.max(1, Math.floor(size / 4));
          continue;
        }
        counts[t] = `error at ${from}: ${res ? res.status : "no answer"}`;
        break;
      }
      const page = (await res.json()) as unknown[];
      rows.push(...page);
      from += page.length;
      if (page.length < size) break;
    }
    if (typeof counts[t] !== "string") counts[t] = rows.length;
    await writeFile(
      path.join(OUT, "tables", `${t}.json`),
      JSON.stringify(rows),
    );
    console.log(`table ${t}: ${counts[t]}`);
  }
  manifest.tables = counts;
}

type Obj = { name: string; id: string | null; metadata?: { size?: number } };

async function storage(manifest: Record<string, unknown>) {
  const r = await call("storage/v1/bucket");
  if (!r.ok) throw new Error(`buckets ${r.status}`);
  const buckets = (await r.json()) as { id: string }[];
  await writeFile(path.join(OUT, "buckets.json"), JSON.stringify(buckets));
  const files: Record<string, { n: number; bytes: number; failed: string[] }> =
    {};
  for (const b of buckets) {
    const f = { n: 0, bytes: 0, failed: [] as string[] };
    files[b.id] = f;
    const walk = async (prefix: string) => {
      for (let offset = 0; ; offset += 1000) {
        const l = await call(`storage/v1/object/list/${b.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            prefix,
            limit: 1000,
            offset,
            sortBy: { column: "name", order: "asc" },
          }),
        });
        if (!l.ok) throw new Error(`list ${b.id}/${prefix} ${l.status}`);
        const items = (await l.json()) as Obj[];
        for (const it of items) {
          const key = prefix ? `${prefix}/${it.name}` : it.name;
          if (it.id === null) {
            await walk(key);
            continue;
          }
          const d = await call(
            `storage/v1/object/${b.id}/${key.split("/").map(encodeURIComponent).join("/")}`,
          ).catch(() => null);
          if (!d || !d.ok) {
            f.failed.push(key);
            continue;
          }
          const buf = Buffer.from(await d.arrayBuffer());
          const to = path.join(OUT, "storage", b.id, key);
          await mkdir(path.dirname(to), { recursive: true });
          await writeFile(to, buf);
          f.n++;
          f.bytes += buf.length;
        }
        if (items.length < 1000) break;
      }
    };
    await walk("");
    console.log(
      `bucket ${b.id}: ${f.n} files, ${f.bytes} bytes, ${f.failed.length} failed`,
    );
  }
  manifest.storage = files;
}

async function users(manifest: Record<string, unknown>) {
  const all: unknown[] = [];
  for (let page = 1; ; page++) {
    const r = await call(`auth/v1/admin/users?page=${page}&per_page=500`);
    if (!r.ok) throw new Error(`users ${r.status}`);
    const j = (await r.json()) as { users: unknown[] };
    all.push(...j.users);
    if (j.users.length < 500) break;
  }
  await writeFile(path.join(OUT, "users.json"), JSON.stringify(all));
  manifest.users = all.length;
  console.log(`users: ${all.length}`);
}

export async function exportAll() {
  await mkdir(OUT, { recursive: true });
  const manifest: Record<string, unknown> = { at: new Date().toISOString() };
  await users(manifest);
  await tables(manifest);
  await storage(manifest);
  await writeFile(
    path.join(OUT, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  return manifest;
}
