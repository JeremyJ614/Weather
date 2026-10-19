import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { LENS_COOKIE } from "./lens-cookie";

export type Role = "member" | "admin" | "founder";
export type Viewer = {
  id: string | null;
  signedIn: boolean;
  name: string | null;
  tier: string | null;
  roles: Role[];
  isAdmin: boolean;
  /** The owner chose to list admin sections in the second menu. */
  adminShortcuts: boolean;
  /** Set while the owner views the app as this member (admin → Members → View as). */
  lens?: { owner: string | null };
};

const SIGNED_OUT: Viewer = {
  id: null,
  signedIn: false,
  name: null,
  tier: null,
  roles: [],
  isAdmin: false,
  adminShortcuts: false,
};

/** Who is signed in, once per request. Roles come from the database, never from the client. */
export const getRealViewer = cache(async (): Promise<Viewer> => {
  const supabase = await supabaseServer();
  // Checked locally against the project's signing key: no auth-server round trip per page.
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  if (!c?.sub) return SIGNED_OUT;
  const user = {
    id: c.sub,
    user_metadata: (c.user_metadata ?? {}) as Record<string, unknown>,
  };
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, nickname, use_nickname, tier")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  const r = (roles ?? []).map((x) => x.role as Role);
  const name = displayName(profile);
  return {
    id: user.id,
    signedIn: true,
    name,
    tier: profile?.tier ?? null,
    roles: r,
    isAdmin: r.includes("admin") || r.includes("founder"),
    adminShortcuts:
      r.includes("founder") && user.user_metadata?.admin_shortcuts === true,
  };
});

type NameRow = {
  first_name: string;
  last_name: string;
  nickname: string | null;
  use_nickname: boolean;
} | null;
const displayName = (p: NameRow) =>
  p
    ? p.use_nickname && p.nickname
      ? p.nickname
      : `${p.first_name} ${p.last_name.slice(0, 1)}.`
    : null;

/**
 * Who the app is for on this request: the signed-in person, or, while the owner views
 * as a member, that member (menus, pages and games show their view). The owner's own
 * session never changes; the database re-checks the owner on every read and write.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const real = await getRealViewer();
  if (!real.roles.includes("founder")) return real;
  const target = (await cookies()).get(LENS_COOKIE)?.value;
  if (!target || !/^[0-9a-f-]{36}$/.test(target)) return real;
  const supabase = await supabaseServer();
  const [{ data: ok }, { data: profile }, { data: roles }] = await Promise.all([
    supabase.rpc("lens_target_ok", { p_user: target }),
    supabase
      .from("profiles")
      .select("first_name, last_name, nickname, use_nickname, tier")
      .eq("id", target)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", target),
  ]);
  if (!ok || !profile) return real;
  return {
    id: target,
    signedIn: true,
    name: displayName(profile),
    tier: profile.tier ?? null,
    roles: (roles ?? []).map((x) => x.role as Role),
    isAdmin: false,
    adminShortcuts: false,
    lens: { owner: real.name },
  };
});
