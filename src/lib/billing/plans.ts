/**
 * Plans, add-ons and promotions (docs/07-PRICING.md). Defaults live here; the owner's
 * edits (admin → Pricing) are saved as app_config `billing` and merged by `cleanBilling`.
 * Money is integer cents everywhere. Pure functions: shared by /join, the admin editor,
 * the server action that saves a member's choice, and tests.
 */
export type TierId = "free" | "basic" | "chasers" | "advanced" | "vip";
export type Cycle = "month" | "year";
export type Tier = {
  id: TierId;
  name: string;
  tagline: string;
  month: number;
  year: number;
  /** Page slugs the tier opens; VIP opens everything. */
  pages: string[];
};

/** Pages that are never sold (always open, or account pages). */
export const ALWAYS = new Set([
  "",
  "news",
  "disaster-response",
  "profile",
  "settings",
  "notifications",
  "login",
  "admin",
]);

const FREE = [
  "",
  "news",
  "dashboard",
  "forecast-discussion",
  "radar-model-runs",
  "spc-probability",
  "wx-games",
  "leaderboard",
  "weekly-polls",
  "weather-glossary",
  "free-content-library",
  "disaster-response",
];
const BASIC = [
  ...FREE,
  "daily-brief",
  "aqi-pollen",
  "mosquito-index",
  "daylight-tracker",
  "mesoscale-discussions",
  "storm-timing-index",
  "hazards-droughts",
  "flooding-outlook",
  "traffic-cameras",
  "tornado-archive",
];

export const DEFAULT_TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    tagline: "The essentials, free forever",
    month: 0,
    year: 0,
    pages: FREE,
  },
  {
    id: "basic",
    name: "Basic",
    tagline: "Your daily weather, sharpened",
    month: 149,
    year: 1399,
    pages: BASIC,
  },
  {
    id: "chasers",
    name: "Storm Chasers",
    tagline: "Everything for the chase",
    month: 299,
    year: 1999,
    pages: [
      ...BASIC,
      "atmospheric-ingredients",
      "tropical-outlook",
      "storm-chasing-outlook",
      "severe-weather-history",
      "3d-soundings",
      "weather-patterns",
      "chasing-log",
    ],
  },
  {
    id: "advanced",
    name: "Advanced",
    tagline: "The full forecaster's desk",
    month: 399,
    year: 2599,
    pages: [
      ...BASIC,
      "sswxcon",
      "warnings-reports",
      "atmospheric-ingredients",
      "fire-weather",
      "winter-center",
      "severe-weather-history",
      "river-flood-gauges",
      "star-gazing",
      "astronomy",
      "climatology",
    ],
  },
  {
    id: "vip",
    name: "VIP",
    tagline: "Everything, forever, plus early access",
    month: 499,
    year: 2999,
    pages: [],
  },
];

export const DEFAULT_ADDONS = {
  /** Cents per page per month. */
  each: 50,
  special: {
    "storm-chasing-outlook": 75,
    extras: 75,
    "chasing-log": 100,
  } as Record<string, number>,
};

export type Promo = {
  id: string;
  name: string;
  blurb: string;
  on: boolean;
  /** Percent off for month 1, 2, 3… of a monthly plan (a yearly plan gets the same value). */
  months: number[];
  /** Percent off the first year of a yearly plan. */
  yearPct?: number;
  /** Only the first N signups that claim it (after `after` earlier claims of `afterPromo`). */
  firstN?: number;
  afterPromo?: string;
  tiers?: TierId[];
  from?: string | null;
  until?: string | null;
};

export const DEFAULT_PROMOS: Promo[] = [
  {
    id: "launch15",
    name: "Launch: first 15",
    blurb: "Month 1 free, month 2 half off",
    on: true,
    months: [100, 50],
    firstN: 15,
  },
  {
    id: "launch25",
    name: "Launch: next 10",
    blurb: "Month 1 75% off, month 2 half off",
    on: true,
    months: [75, 50],
    firstN: 10,
    afterPromo: "launch15",
  },
  {
    id: "kickoff",
    name: "Storm Season Kickoff",
    blurb: "30% off your first 3 months",
    on: false,
    months: [30, 30, 30],
    from: null,
    until: null,
  },
  {
    id: "yearly",
    name: "Go Yearly",
    blurb: "20% off your first year",
    on: false,
    months: [],
    yearPct: 20,
  },
  {
    id: "friend",
    name: "Bring a Friend",
    blurb: "You and your friend both get next month free",
    on: false,
    months: [],
  },
  {
    id: "hurricane",
    name: "Hurricane Season Pass",
    blurb: "Storm Chasers 40% off, June to November",
    on: false,
    months: [40, 40, 40, 40, 40, 40],
    tiers: ["chasers"],
  },
  {
    id: "holiday",
    name: "Holiday Bundle",
    blurb: "Yearly VIP includes 2 add-ons free",
    on: false,
    months: [],
    tiers: ["vip"],
  },
];

export type Billing = {
  tiers: Tier[];
  addons: typeof DEFAULT_ADDONS;
  promos: Promo[];
  /** A yearly custom plan costs this many months (the rest are free). */
  customYearMonths: number;
};
export const DEFAULT_BILLING: Billing = {
  tiers: DEFAULT_TIERS,
  addons: DEFAULT_ADDONS,
  promos: DEFAULT_PROMOS,
  customYearMonths: 10,
};

const cents = (v: unknown, max = 100000) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
};
const pct = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};
const day = (v: unknown) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

/** The owner's saved edits over the defaults; anything invalid keeps its default. */
export function cleanBilling(raw: unknown, sellable: Set<string>): Billing {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const savedTiers = Array.isArray(o.tiers)
    ? (o.tiers as Record<string, unknown>[])
    : [];
  const tiers = DEFAULT_TIERS.map((d) => {
    const s = savedTiers.find((t) => t?.id === d.id) ?? {};
    return {
      ...d,
      name:
        typeof s.name === "string" && s.name.trim()
          ? s.name.trim().slice(0, 30)
          : d.name,
      tagline:
        typeof s.tagline === "string"
          ? s.tagline.trim().slice(0, 80) || d.tagline
          : d.tagline,
      month: d.id === "free" ? 0 : (cents(s.month) ?? d.month),
      year: d.id === "free" ? 0 : (cents(s.year) ?? d.year),
      pages:
        d.id === "vip"
          ? []
          : Array.isArray(s.pages)
            ? [
                ...new Set(
                  (s.pages as unknown[]).filter(
                    (x): x is string =>
                      typeof x === "string" &&
                      (sellable.has(x) || ALWAYS.has(x)),
                  ),
                ),
              ]
            : d.pages,
    };
  });
  const a = (o.addons ?? {}) as Record<string, unknown>;
  const special: Record<string, number> = { ...DEFAULT_ADDONS.special };
  if (a.special && typeof a.special === "object")
    for (const [k, v] of Object.entries(a.special as Record<string, unknown>)) {
      const c = cents(v, 10000);
      if (sellable.has(k) && c !== null) special[k] = c;
    }
  const savedPromos = Array.isArray(o.promos)
    ? (o.promos as Record<string, unknown>[])
    : [];
  const promos = DEFAULT_PROMOS.map((d) => {
    const s = savedPromos.find((p) => p?.id === d.id);
    if (!s) return d;
    const months = Array.isArray(s.months)
      ? (s.months as unknown[])
          .slice(0, 12)
          .map(pct)
          .filter((x): x is number => x !== null)
      : d.months;
    const n = Math.round(Number(s.firstN));
    return {
      ...d,
      on: s.on === true,
      blurb:
        typeof s.blurb === "string" && s.blurb.trim()
          ? s.blurb.trim().slice(0, 120)
          : d.blurb,
      months,
      yearPct:
        s.yearPct === undefined ? d.yearPct : (pct(s.yearPct) ?? d.yearPct),
      firstN:
        d.firstN === undefined
          ? undefined
          : Number.isInteger(n) && n > 0 && n <= 10000
            ? n
            : d.firstN,
      from: day(s.from) ?? null,
      until: day(s.until) ?? null,
    };
  });
  const cym = Math.round(Number(o.customYearMonths));
  return {
    tiers,
    addons: { each: cents(a.each, 10000) ?? DEFAULT_ADDONS.each, special },
    promos,
    customYearMonths:
      cym >= 1 && cym <= 12 ? cym : DEFAULT_BILLING.customYearMonths,
  };
}

export type Choice = {
  tier: TierId | "custom";
  cycle: Cycle;
  /** Pages of a custom plan. */
  pages: string[];
  /** Extra pages on top of a tier. */
  addons: string[];
};

export const addonPrice = (b: Billing, slug: string) =>
  b.addons.special[slug] ?? b.addons.each;

/** Which pages a tier opens (VIP: every sellable page). */
export function tierPages(
  b: Billing,
  id: TierId,
  sellable: string[],
): Set<string> {
  const t = b.tiers.find((x) => x.id === id)!;
  return new Set(id === "vip" ? sellable : t.pages);
}

/** Today's (ISO date) promotions that apply to a choice; `claims` counts promo uses so far. */
export function activePromos(
  b: Billing,
  claims: Record<string, number>,
  today: string,
  choice?: Choice,
): (Promo & { left?: number })[] {
  return b.promos.flatMap((p) => {
    if (!p.on) return [];
    if (p.from && today < p.from) return [];
    if (p.until && today > p.until) return [];
    if (
      choice &&
      p.tiers &&
      (choice.tier === "custom" || !p.tiers.includes(choice.tier))
    )
      return [];
    if (p.afterPromo) {
      const before = b.promos.find((x) => x.id === p.afterPromo);
      if (
        before?.on &&
        before.firstN &&
        (claims[before.id] ?? 0) < before.firstN
      )
        return [];
    }
    if (p.firstN) {
      const left = p.firstN - (claims[p.id] ?? 0);
      return left > 0 ? [{ ...p, left }] : [];
    }
    return [p];
  });
}

export type Quote = {
  /** Regular price per cycle, in cents. */
  base: number;
  addons: number;
  regular: number;
  /** What the first charges cost after the best promotion (per cycle). */
  first: number[];
  promo: Promo | null;
  monthlyEquivalent: number;
};

/** Prices a choice. Only promotions that lower a paid plan are applied; the best one wins. */
export function quote(
  b: Billing,
  choice: Choice,
  sellable: string[],
  promos: Promo[] = [],
): Quote {
  const yearly = choice.cycle === "year";
  let base = 0;
  let covered = new Set<string>();
  if (choice.tier === "custom") {
    const per = choice.pages
      .filter((p) => sellable.includes(p))
      .reduce((a, p) => a + addonPrice(b, p), 0);
    base = yearly ? per * b.customYearMonths : per;
  } else {
    const t = b.tiers.find((x) => x.id === choice.tier)!;
    base = yearly ? t.year : t.month;
    covered = tierPages(b, choice.tier, sellable);
  }
  const extras =
    choice.tier === "custom"
      ? []
      : choice.addons.filter((p) => sellable.includes(p) && !covered.has(p));
  const addonsPer = extras.reduce((a, p) => a + addonPrice(b, p), 0);
  const addons = yearly ? addonsPer * 12 : addonsPer;
  const regular = base + addons;
  let best: { promo: Promo; first: number[]; saved: number } | null = null;
  if (regular > 0)
    for (const p of promos) {
      let first: number[] = [];
      if (yearly) {
        const monthValue = regular / 12;
        const off =
          (p.yearPct ? (regular * p.yearPct) / 100 : 0) +
          p.months.reduce((a, m) => a + (monthValue * m) / 100, 0);
        first = [Math.max(0, Math.round(regular - off))];
      } else {
        first = p.months.map((m) => Math.round((regular * (100 - m)) / 100));
      }
      const saved = yearly
        ? regular - first[0]
        : first.reduce((a, f) => a + (regular - f), 0);
      if (saved > 0 && (!best || saved > best.saved))
        best = { promo: p, first, saved };
    }
  return {
    base,
    addons,
    regular,
    first: best?.first ?? [regular],
    promo: best?.promo ?? null,
    monthlyEquivalent: yearly ? Math.round(regular / 12) : regular,
  };
}

/** A coupon's discount on the first charge. */
export function couponOff(
  first: number,
  c: { kind: string; amount: number } | null,
): number {
  if (!c) return first;
  return c.kind === "percent"
    ? Math.round((first * (100 - c.amount)) / 100)
    : Math.max(0, first - c.amount);
}

export const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export type MemberPlan = {
  tier: string;
  status: string;
  comped: boolean | null;
  pages: string[];
  addons: string[];
} | null;

/**
 * Whether a member's plan opens a page (plan locks, admin → Pricing). Pages never sold are
 * always open. Until a plan is paid (or comped) it counts as Free, so choosing a plan opens
 * nothing by itself; a custom plan opens its own pages and add-ons open on top of a tier.
 */
export function planOpens(
  b: Billing,
  plan: MemberPlan,
  slug: string,
  sellable: string[],
) {
  if (!sellable.includes(slug)) return true;
  const paid = Boolean(plan && (plan.status === "active" || plan.comped));
  if (!paid || !plan) return tierPages(b, "free", sellable).has(slug);
  if (plan.addons.includes(slug)) return true;
  if (plan.tier === "custom")
    return (
      plan.pages.includes(slug) || tierPages(b, "free", sellable).has(slug)
    );
  const tier = b.tiers.some((t) => t.id === plan.tier)
    ? (plan.tier as TierId)
    : "free";
  return tierPages(b, tier, sellable).has(slug);
}

/** The cheapest tier that opens a page, for the "this page is on…" note. */
export function cheapestTier(b: Billing, slug: string, sellable: string[]) {
  return [...b.tiers]
    .sort((x, y) => x.month - y.month)
    .find((t) => tierPages(b, t.id, sellable).has(slug));
}
