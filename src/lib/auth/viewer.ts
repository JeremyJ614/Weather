import "server-only";
import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";

export type Role = "member" | "admin" | "founder";
export type Viewer = {
  signedIn: boolean;
  name: string | null;
  tier: string | null;
  roles: Role[];
  isAdmin: boolean;
};

const SIGNED_OUT: Viewer = {
  signedIn: false,
  name: null,
  tier: null,
  roles: [],
  isAdmin: false,
};

/** Who is asking, once per request. Roles come from the database, never from the client. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return SIGNED_OUT;
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, nickname, use_nickname, tier")
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  const r = (roles ?? []).map((x) => x.role as Role);
  const name = profile
    ? profile.use_nickname && profile.nickname
      ? profile.nickname
      : `${profile.first_name} ${profile.last_name.slice(0, 1)}.`
    : null;
  return {
    signedIn: true,
    name,
    tier: profile?.tier ?? null,
    roles: r,
    isAdmin: r.includes("admin") || r.includes("founder"),
  };
});
