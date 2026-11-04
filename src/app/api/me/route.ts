import { getViewer } from "@/lib/auth/viewer";
import { supabaseServer } from "@/lib/supabase/server";
import { cleanBilling, planOpens, type MemberPlan } from "@/lib/billing/plans";
import { SELLABLE_SLUGS } from "@/lib/billing/sellable";

const SELLABLE_SET = new Set(SELLABLE_SLUGS);

/**
 * The signed-in viewer's name and roles for client UI (menus), plus the pages their plan
 * doesn't open while plan locks are on (the Quick Menu leaves those out). Never cached.
 */
export async function GET() {
  const v = await getViewer();
  let locked: string[] = [];
  if (
    v.signedIn &&
    !v.isAdmin &&
    !v.roles.includes("member") &&
    !v.roles.includes("recruit")
  ) {
    const { data } = await (
      await supabaseServer()
    ).rpc("page_gate", {
      p_slug: "",
    });
    const gate = data as {
      locks?: boolean;
      plan?: MemberPlan;
      billing?: unknown;
    } | null;
    if (gate?.locks) {
      const b = cleanBilling(gate.billing, SELLABLE_SET);
      locked = SELLABLE_SLUGS.filter(
        (s) => !planOpens(b, gate.plan ?? null, s, SELLABLE_SLUGS),
      );
    }
  }
  return Response.json(
    { ...v, locked },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
