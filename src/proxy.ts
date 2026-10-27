import { REMEMBER_COOKIE, sessionOptions } from "@/lib/supabase/remember";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { GUEST_PATHS } from "@/lib/nav/registry";
import { EVERY_PAGE } from "@/lib/nav/extras";
import { cleanBilling, planOpens, type MemberPlan } from "@/lib/billing/plans";
import { SELLABLE_SLUGS } from "@/lib/billing/sellable";

const SLUGS = new Set(EVERY_PAGE.map((p) => p.slug).filter(Boolean));
const SELLABLE_SET = new Set(SELLABLE_SLUGS);

/**
 * Refreshes the Supabase session cookie on each page request so sign-ins stay alive, and
 * sends guests asking for a members' page to the signup gate on the Homepage.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        const remember = request.cookies.get(REMEMBER_COOKIE)?.value;
        list.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, sessionOptions(remember, options)),
        );
      },
    },
  });
  // Verified locally against the project's signing key (no round trip to the auth server);
  // it still refreshes an expiring session.
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims?.sub ? { id: claims.claims.sub } : null;
  const path = request.nextUrl.pathname;
  if (!user && !GUEST_PATHS.test(path) && request.method === "GET") {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    to.search = `?join=${encodeURIComponent(path)}`;
    return NextResponse.redirect(to);
  }
  // A page an admin closed to this member (admin → Members → Pages), and, once the owner
  // turns plan locks on (admin → Pricing), a page the member's plan doesn't open.
  const slug = path.split("/")[1];
  if (user && SLUGS.has(slug) && slug !== "admin") {
    const { data } = await supabase.rpc("page_gate", { p_slug: slug });
    const gate = data as {
      closed?: boolean;
      locks?: boolean;
      plan?: MemberPlan;
      billing?: unknown;
    } | null;
    const to = request.nextUrl.clone();
    if (gate?.closed) {
      to.pathname = "/closed";
      to.search = `?page=${slug}`;
      return NextResponse.redirect(to);
    }
    if (
      gate?.locks &&
      !planOpens(
        cleanBilling(gate.billing, SELLABLE_SET),
        gate.plan ?? null,
        slug,
        SELLABLE_SLUGS,
      )
    ) {
      to.pathname = "/join";
      to.search = `?locked=${slug}`;
      return NextResponse.redirect(to);
    }
  }
  return response;
}

export const config = {
  // Skip static files, images, the service worker and API routes that don't need a session.
  matcher: [
    "/((?!_next/static|_next/image|\\.well-known|downloads/|vendor|icons|brand|archive/|extras/|sw.js|manifest.webmanifest|api/weather|api/geo|api/cron|api/sswxcon|api/warnings|api/reports|api/spc|api/ingredients|api/maps|api/tropical|api/hazards|api/flood|api/fire|api/winter|api/history|api/models|api/rivers|api/soundings|api/sky|api/aurora|api/lightning|api/climo|api/patterns|api/engines|api/archive|api/stripe/webhook|.*\\.(?:png|jpe?g|webp|svg|ico|mjs)$).*)",
  ],
};
