import { canSeeCams } from "@/lib/cams/access";
import { HTTP_HOSTS } from "@/lib/cams/sources";

/** GET /api/cams/img?u= → a camera still from an http-only DOT host, served over https. */
export async function GET(req: Request) {
  if (!(await canSeeCams())) return new Response(null, { status: 404 });
  let u: URL;
  try {
    u = new URL(new URL(req.url).searchParams.get("u") ?? "");
  } catch {
    return new Response(null, { status: 400 });
  }
  if (
    u.protocol !== "http:" ||
    !HTTP_HOSTS.includes(u.host) ||
    !/\.jpe?g$/i.test(u.pathname)
  )
    return new Response(null, { status: 400 });
  const r = await fetch(u, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!r?.ok || !r.headers.get("content-type")?.startsWith("image/"))
    return new Response(null, { status: 502 });
  return new Response(r.body, {
    headers: {
      "Content-Type": r.headers.get("content-type")!,
      "Cache-Control": "private, max-age=60",
    },
  });
}
