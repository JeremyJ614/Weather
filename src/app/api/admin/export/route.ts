import { getViewer } from "@/lib/auth/viewer";
import { supabaseServer } from "@/lib/supabase/server";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Quote everything; neutralise spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replaceAll('"', '""')}"`;
};

/** GET /api/admin/export?what=members → CSV. Members admins only. */
export async function GET(request: Request) {
  const what = new URL(request.url).searchParams.get("what");
  if (what !== "members")
    return new Response("Unknown export", { status: 400 });
  const viewer = await getViewer();
  if (!viewer.isAdmin) return new Response("Not found", { status: 404 });
  const supabase = await supabaseServer();
  const { data: ok } = await supabase.rpc("can_admin", { s: "members" });
  if (!ok) return new Response("Not found", { status: 404 });

  const [{ data: rows }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, first_name, last_name, nickname, city, state, phone, tier, referral_code, referred_by, found_us, created_at",
      )
      .order("created_at"),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  const roleOf = new Map<string, string[]>();
  (roles ?? []).forEach((r) =>
    roleOf.set(r.user_id, [...(roleOf.get(r.user_id) ?? []), r.role]),
  );
  const code = new Map((rows ?? []).map((r) => [r.id, r.referral_code]));
  const head = [
    "First name",
    "Last name",
    "Nickname",
    "City",
    "State",
    "Phone",
    "Plan",
    "Roles",
    "Referral code",
    "Referred by code",
    "Found us",
    "Joined",
  ];
  const lines = (rows ?? []).map((r) =>
    [
      r.first_name,
      r.last_name,
      r.nickname,
      r.city,
      r.state,
      r.phone,
      r.tier,
      (roleOf.get(r.id) ?? []).join(" "),
      r.referral_code,
      r.referred_by ? code.get(r.referred_by) : "",
      r.found_us,
      r.created_at,
    ]
      .map(cell)
      .join(","),
  );
  await supabase.rpc("log_admin", {
    p_action: "export",
    p_target: "members",
    p_detail: { rows: lines.length },
  });
  return new Response([head.map(cell).join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sswx-members-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
