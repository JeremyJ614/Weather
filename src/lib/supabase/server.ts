import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import { REMEMBER_COOKIE, sessionOptions } from "./remember";

/** Supabase client for server components and route handlers, as the signed-in user. */
export async function supabaseServer() {
  // Reading cookies first marks the page as per-request, so builds never try to prerender it.
  const store = await cookies();
  const { supabaseUrl, supabaseAnonKey } = publicEnv();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          const remember = store.get(REMEMBER_COOKIE)?.value;
          list.forEach(({ name, value, options }) =>
            store.set(name, value, sessionOptions(remember, options)),
          );
        } catch {
          // Called from a server component, where cookies are read-only; the proxy refreshes them.
        }
      },
    },
  });
}
