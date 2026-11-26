import { isJobsToken } from "@/lib/jobs/oidc";
import { publicEnv } from "@/lib/env";

/**
 * Database relay for the scheduled jobs on GitHub Actions (post-launch A1 "cost-guard"): the
 * heavy work (model downloads, engine maps) runs there, and only the reads and writes pass
 * through here with the server's service key. Every call must carry a GitHub OIDC token from
 * this repository's jobs workflow on main; only the REST and Storage APIs are reachable, plus
 * reading the member list (Auth admin, GET only) for the project move.
 */
export const maxDuration = 30;

const PASS = [
  "accept",
  "accept-profile",
  "content-profile",
  "content-type",
  "prefer",
  "range",
  "x-upsert",
  "cache-control",
  "x-client-info",
];
const BACK = [
  "content-type",
  "content-range",
  "preference-applied",
  "etag",
  "content-location",
];

async function relay(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const token =
    req.headers.get("apikey") ??
    req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!(await isJobsToken(token)))
    return new Response("Forbidden", { status: 403 });
  const path = (await params).path.join("/");
  // The project move (2026-11-26) also reads the member list, and nothing else of Auth.
  const members = req.method === "GET" && path === "auth/v1/admin/users";
  if (!/^(rest|storage)\/v1\//.test(path) && !members)
    return new Response("Not found", { status: 404 });
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return new Response("Not configured", { status: 503 });
  const headers = new Headers({ apikey: key, authorization: `Bearer ${key}` });
  for (const h of PASS) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  const url = `${publicEnv().supabaseUrl}/${path}${new URL(req.url).search}`;
  const body = ["GET", "HEAD"].includes(req.method)
    ? undefined
    : await req.arrayBuffer();
  const up = await fetch(url, {
    method: req.method,
    headers,
    body,
    cache: "no-store",
  });
  const out = new Headers();
  for (const h of BACK) {
    const v = up.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(up.body, { status: up.status, headers: out });
}

export const GET = relay;
export const POST = relay;
export const PATCH = relay;
export const PUT = relay;
export const DELETE = relay;
export const HEAD = relay;
