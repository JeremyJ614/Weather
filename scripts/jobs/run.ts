/**
 * Runs the heavy scheduled jobs outside Vercel (post-launch A1 "cost-guard"): GitHub Actions
 * calls this on the same schedule pg_cron uses, with the service key as a secret, and the
 * Vercel routes stand down while JOBS_ON_ACTIONS=1. Same code as the cron routes, so the maps
 * land in the same tables.
 *
 *   npx tsx --conditions=react-server scripts/jobs/run.ts engines|outdoor|verify|surge
 *   npx tsx --conditions=react-server scripts/jobs/run.ts dry <field engine id>
 */
const job = process.argv[2];
// An empty argument (scheduled runs pass none) counts as none.
const arg = process.argv[3] || undefined;

async function main() {
  switch (job) {
    case "engines":
      // No 60-second request limit here: a longer budget, and Blizzard refreshed after every
      // HRRR run from October to April whether or not anyone opened it.
      return (await import("../../src/lib/engines/stored")).refreshWanted(
        3,
        600_000,
        [9, 10, 11, 0, 1, 2, 3].includes(new Date().getUTCMonth())
          ? ["blizz"]
          : [],
      );
    case "outdoor":
      return (
        await import("../../src/lib/engines/outmap")
      ).refreshOutdoorIfStale();
    case "verify":
      return (await import("../../src/lib/engines/verify")).verifyChecks();
    case "surge":
      return (await import("../../src/lib/engines/surge")).logSurges();
    case "indexnow": {
      // B7: once a day every page in the sitemap goes to IndexNow (Bing, Yandex, Seznam,
      // Naver), so new and changed pages are crawled within hours without Webmaster Tools.
      const site = "https://weather.sswx.space";
      const xml = await (await fetch(`${site}/sitemap.xml`)).text();
      const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      const { INDEXNOW_KEY } = await import("../../src/lib/seo/indexnow");
      const r = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: "weather.sswx.space",
          key: INDEXNOW_KEY,
          keyLocation: `${site}/${INDEXNOW_KEY}.txt`,
          urlList: urls.slice(0, 10000),
        }),
      });
      return { submitted: urls.length, status: r.status };
    }
    case "sizes": {
      // B11: the newest daily storage snapshots (database and file sizes), read for free-tier checks.
      const { supabaseAdmin } = await import("../../src/lib/supabase/admin");
      const { data, error } = await supabaseAdmin()
        .from("storage_snapshots")
        .select("*")
        .order("day", { ascending: false })
        .limit(3);
      if (error) throw new Error(error.message);
      return data;
    }
    case "cron": {
      // Fix it List #40: re-runs one of the site's scheduled routes now, e.g.
      // `cron patterns?part=month`, signed with this workflow's OIDC token.
      if (!arg || !/^[a-z][a-z/-]*(\?[a-z0-9=&-]*)?$/.test(arg))
        throw new Error("cron needs a route like patterns?part=month");
      const { actionsToken } = await import("../../src/lib/jobs/oidc");
      const r = await fetch(`https://weather.sswx.space/api/cron/${arg}`, {
        headers: { authorization: `Bearer ${await actionsToken()}` },
        signal: AbortSignal.timeout(120_000),
      });
      const body = await r.text();
      if (!r.ok) throw new Error(`${r.status} ${body.slice(0, 300)}`);
      return { status: r.status, body: body.slice(0, 2000) };
    }
    case "usage": {
      // Fix it List #39, 3: the usage meter's month so far (calls and CPU by route, projected
      // against Hobby), read without the dashboard for free-tier checks.
      const { usageReport } = await import("../../src/lib/ops/usage");
      const r = await usageReport(Number(arg ?? 24));
      return r;
    }
    case "export":
      // The Supabase project move: everything the live project holds, for the sealed artifact.
      return (await import("./export")).exportAll();
    case "dry": {
      // Computes one engine without storing it: proves the runner works on a new machine.
      const id = arg ?? "stp";
      const { fieldEngine } = await import("../../src/lib/engines/fields");
      const t = Date.now();
      const m = await fieldEngine(id as never);
      return {
        engine: id,
        cycle: m.cycle,
        areas: m.areas.features.length,
        spots: m.spots.length,
        seconds: (Date.now() - t) / 1000,
      };
    }
    default:
      throw new Error(
        `Unknown job "${job}". Use engines, outdoor, verify, surge, indexnow, sizes, usage, cron, export or dry.`,
      );
  }
}

main().then(
  (r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  },
  (e) => {
    console.error(e instanceof Error ? e.stack : e);
    process.exit(1);
  },
);
