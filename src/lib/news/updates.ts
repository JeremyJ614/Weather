export type Release = {
  id: string;
  version: string;
  title: string;
  notes: string;
  published_at: string;
};
export type NewMember = { initials: string; joined: string };

const opts = (key: string) => ({
  headers: { apikey: key, "Content-Type": "application/json" },
  next: { revalidate: 600, tags: ["app-updates"] },
});

/** Release notes and new members for the App Updates tab. */
export async function getAppUpdates(): Promise<{
  releases: Release[];
  members: NewMember[];
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { releases: [], members: [] };
  try {
    const [releases, members] = await Promise.all([
      fetch(
        `${url}/rest/v1/app_releases?select=*&order=published_at.desc&limit=20`,
        opts(key),
      ).then((r) => (r.ok ? r.json() : [])),
      fetch(`${url}/rest/v1/rpc/recent_members`, {
        ...opts(key),
        method: "POST",
        body: "{}",
      }).then((r) => (r.ok ? r.json() : [])),
    ]);
    return { releases, members };
  } catch {
    return { releases: [], members: [] };
  }
}
