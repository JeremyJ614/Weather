/**
 * Public environment, validated once. These two values are safe in the browser:
 * the publishable key only reaches data that Row Level Security allows.
 * Server-only secrets are read in server modules and never imported here.
 */
export function publicEnv(
  source: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
) {
  const url = source.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = source.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is missing or not a Supabase URL",
    );
  }
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");
  if (/service_role|^sb_secret_/.test(anonKey) || isServiceRoleJwt(anonKey)) {
    throw new Error("A secret key was put in a public variable");
  }
  return { supabaseUrl: url, supabaseAnonKey: anonKey };
}

function isServiceRoleJwt(key: string): boolean {
  const part = key.split(".")[1];
  if (!part) return false;
  try {
    const json = JSON.parse(
      Buffer.from(
        part.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString(),
    );
    return json.role === "service_role";
  } catch {
    return false;
  }
}
