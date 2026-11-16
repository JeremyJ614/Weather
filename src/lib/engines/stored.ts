import "server-only";
import { latestCycle } from "@/lib/models/render";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { FIELD_BANDS, type FieldId } from "./colors";
import { fieldEngine } from "./fields";
import { packAreas, type Packed } from "./pack";

/**
 * Performance #1: engine maps live in `engine_maps`, one row per engine. A map is computed
 * once per HRRR run and every visitor after that (any server, any region, cold or warm) is
 * served the stored copy. When a newer run is out the stored copy is still served at once
 * and the new one is computed behind it, so nobody waits on the model but the very first.
 */
type Computed = Awaited<ReturnType<typeof fieldEngine>>;
/** A map as stored and served: its shapes packed (lib/engines/pack.ts). */
export type FieldMap = Omit<Computed, "areas" | "alt"> & {
  areas: Packed | Computed["areas"];
  alt?: Packed | Computed["areas"] | null;
};
const pack = (m: Computed): FieldMap => ({
  ...m,
  areas: m.areas ? packAreas(m.areas) : m.areas,
  alt: m.alt ? packAreas(m.alt) : m.alt,
});

type Row = {
  id: string;
  cycle: string;
  data: FieldMap;
  checked_at: string;
  wanted_at: string;
};

/** Checked against the newest HRRR run at most this often. */
const RECHECK_MS = 15 * 60_000;
/** A visitor's interest is written down at most this often per engine. */
const WANT_MS = 30 * 60_000;
/** A refresh claim older than this has died and can be taken over. */
const CLAIM_MS = 2 * 60_000;

/** A warm server trusts its own copy this long before looking at the table again. */
const MEMO_MS = 5 * 60_000;

const age = (iso: string) => Date.now() - Date.parse(iso);

/**
 * This server's copy of each map. A warm server serves from it, and reads the map itself
 * from the table only when the stored run has moved on, which keeps database egress to
 * about one map per server per run.
 */
const memo = new Map<FieldId, { data: FieldMap; at: number }>();
const remember = (id: FieldId, data: FieldMap) =>
  memo.set(id, { data, at: Date.now() });

async function read(id: FieldId): Promise<Row | null> {
  const db = supabaseAdmin();
  const { data: head } = await db
    .from("engine_maps")
    .select("id, cycle, checked_at, wanted_at")
    .eq("id", id)
    .maybeSingle();
  if (!head) return null;
  const mine = memo.get(id)?.data;
  if (mine && mine.cycle === head.cycle)
    return { ...(head as Row), data: mine };
  const { data } = await db
    .from("engine_maps")
    .select("data")
    .eq("id", id)
    .maybeSingle();
  return data
    ? { ...(head as Row), data: (data as Pick<Row, "data">).data }
    : null;
}

/** Takes the refresh for one engine unless another server is already on it. */
async function claim(id: FieldId) {
  const db = supabaseAdmin();
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - CLAIM_MS).toISOString();
  const { data } = await db
    .from("engine_maps")
    .update({ refreshing_at: now })
    .eq("id", id)
    .or(`refreshing_at.is.null,refreshing_at.lt.${stale}`)
    .select("id");
  return Boolean(data?.length);
}

/** Computes one engine's map and stores it; returns the map. */
export async function refreshField(id: FieldId): Promise<FieldMap> {
  const map = pack(await fieldEngine(id));
  remember(id, map);
  const now = new Date().toISOString();
  // A storage failure costs the next visitor a recompute, never this visitor their map.
  try {
    const { error } = await supabaseAdmin().from("engine_maps").upsert({
      id,
      cycle: map.cycle,
      data: map,
      computed_at: now,
      checked_at: now,
      refreshing_at: null,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("engine_maps upsert", id, e);
  }
  return map;
}

/**
 * One engine's map for a visitor, and `later`: the refresh to run after the response when
 * the stored copy is behind the newest run (null when it is current).
 */
export async function storedField(
  id: FieldId,
  /** Skip this server's copy and read the stored map (a refresh key press). */
  fresh = false,
): Promise<{ map: FieldMap; later: (() => Promise<unknown>) | null }> {
  const mine = memo.get(id);
  if (!fresh && mine && Date.now() - mine.at < MEMO_MS)
    return { map: mine.data, later: null };
  const row = await read(id).catch(() => null);
  if (!row) return { map: await refreshField(id), later: null };
  remember(id, row.data);
  const db = supabaseAdmin();
  if (age(row.wanted_at) > WANT_MS)
    void db
      .from("engine_maps")
      .update({ wanted_at: new Date().toISOString() })
      .eq("id", id)
      .then(() => undefined);
  if (age(row.checked_at) < RECHECK_MS) return { map: row.data, later: null };
  const newest = await latestCycle("hrrr").catch(() => null);
  if (!newest || newest <= row.cycle) {
    // Current: note the check so the next visitors skip it for a while.
    void db
      .from("engine_maps")
      .update({ checked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("cycle", row.cycle)
      .then(() => undefined);
    return { map: row.data, later: null };
  }
  return {
    map: row.data,
    later: async () => {
      if (await claim(id)) await refreshField(id);
    },
  };
}

/**
 * The scheduled refresh: every engine someone viewed in the last `hours` whose stored map is
 * behind the newest run, oldest first, until `budgetMs` runs out.
 */
export async function refreshWanted(
  hours = 3,
  budgetMs = 40_000,
  always: FieldId[] = [],
) {
  const start = Date.now();
  const newest = await latestCycle("hrrr");
  if (!newest) return { newest: null, refreshed: [] as string[] };
  const { data } = await supabaseAdmin()
    .from("engine_maps")
    .select("id, cycle, wanted_at")
    .lt("cycle", newest)
    .gt("wanted_at", new Date(Date.now() - hours * 3600_000).toISOString())
    .order("computed_at", { ascending: true });
  const refreshed: string[] = [];
  for (const r of (data ?? []) as Pick<Row, "id" | "cycle">[]) {
    if (Date.now() - start > budgetMs) break;
    const id = r.id as FieldId;
    // A retired engine's last map stays in the table until it is pruned.
    if (!(id in FIELD_BANDS) || !(await claim(id))) continue;
    try {
      await refreshField(id);
      refreshed.push(id);
    } catch (e) {
      console.error("engine refresh", id, e);
    }
  }
  // Maps kept fresh whether or not anyone looked (the GitHub Actions job: Blizzard in the
  // cold season, so its page opens at once with the whole two days counted).
  for (const id of always) {
    if (refreshed.includes(id) || Date.now() - start > budgetMs) continue;
    const { data: row } = await supabaseAdmin()
      .from("engine_maps")
      .select("cycle")
      .eq("id", id)
      .maybeSingle();
    if (row && row.cycle >= newest) continue;
    if (!(await claim(id))) continue;
    try {
      await refreshField(id);
      refreshed.push(id);
    } catch (e) {
      console.error("engine refresh", id, e);
    }
  }
  return { newest, refreshed };
}
