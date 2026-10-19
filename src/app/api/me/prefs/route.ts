import { supabaseServer } from "@/lib/supabase/server";
import { cleanPrefs } from "@/lib/prefs";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** GET /api/me/prefs → the signed-in member's saved menus, theme, intro and places. */
export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({}, { headers: NO_STORE });
  return Response.json(cleanPrefs(user.user_metadata?.prefs), {
    headers: NO_STORE,
  });
}

/** POST /api/me/prefs {menus?, theme?, intro?, places?} → merged into the account. */
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return Response.json({ error: "Sign in to save." }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  const next = {
    ...cleanPrefs(user.user_metadata?.prefs),
    ...cleanPrefs(body),
  };
  // A cleared list of places is a real choice too.
  if (
    body &&
    typeof body === "object" &&
    "places" in body &&
    !cleanPrefs(body).places
  )
    delete next.places;
  const { error } = await supabase.auth.updateUser({ data: { prefs: next } });
  if (error) return Response.json({ error: "Couldn't save." }, { status: 502 });
  return Response.json(next, { headers: NO_STORE });
}
