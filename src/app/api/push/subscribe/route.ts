import { supabaseServer } from "@/lib/supabase/server";

type Sub = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** POST a PushSubscription (signed-in members). DELETE with { endpoint } to stop. */
export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in first" }, { status: 401 });
  const s = (await request.json().catch(() => ({}))) as Sub;
  if (!s.endpoint?.startsWith("https://") || !s.keys?.p256dh || !s.keys.auth) {
    return Response.json({ error: "Not a push subscription" }, { status: 400 });
  }
  const { error } = await supabase.from("push_subscriptions").upsert({
    endpoint: s.endpoint,
    user_id: user.id,
    p256dh: s.keys.p256dh,
    auth: s.keys.auth,
  });
  return error
    ? Response.json({ error: "Couldn't save" }, { status: 500 })
    : Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await supabaseServer();
  const { endpoint } = (await request.json().catch(() => ({}))) as Sub;
  if (endpoint)
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return Response.json({ ok: true });
}
