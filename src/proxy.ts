import { REMEMBER_COOKIE, sessionOptions } from "@/lib/supabase/remember";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { GUEST_PATHS } from "@/lib/nav/registry";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (!user && !GUEST_PATHS.test(path) && request.method === "GET") {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    to.search = `?join=${encodeURIComponent(path)}`;
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  // Skip static files, images, the service worker and API routes that don't need a session.
  matcher: [
    "/((?!_next/static|_next/image|vendor|icons|brand|sw.js|manifest.webmanifest|api/weather|api/geo|api/cron|api/sswxcon|api/warnings|api/reports|api/spc|api/ingredients|api/maps|.*\\.(?:png|webp|svg|ico|mjs)$).*)",
  ],
};
