import { randomUUID } from "node:crypto";
import { getViewer } from "@/lib/auth/viewer";
import { supabaseServer } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};
const MAX = 2 * 1024 * 1024;

/** POST ?post=<uuid> with an image body → { path, url }. News admins only. */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer.isAdmin) return new Response("Not found", { status: 404 });
  const supabase = await supabaseServer();
  const { data: ok } = await supabase.rpc("can_admin", { s: "news" });
  if (!ok) return new Response("Not found", { status: 404 });

  const post = new URL(request.url).searchParams.get("post") ?? "";
  const type = request.headers.get("content-type") ?? "";
  if (!UUID.test(post))
    return Response.json({ error: "Bad post id" }, { status: 400 });
  if (!TYPES[type])
    return Response.json(
      { error: "Use a WebP, JPEG or PNG image." },
      { status: 415 },
    );
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX)
    return Response.json(
      { error: "Images can be up to 2 MB." },
      { status: 413 },
    );

  const path = `${post}/${randomUUID()}.${TYPES[type]}`;
  const { error } = await supabase.storage.from("news").upload(path, body, {
    contentType: type,
    cacheControl: "31536000",
  });
  if (error)
    return Response.json(
      { error: "Upload failed. Try again." },
      { status: 502 },
    );
  const { data } = supabase.storage.from("news").getPublicUrl(path);
  return Response.json({ path, url: data.publicUrl });
}
