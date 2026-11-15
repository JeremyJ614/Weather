/**
 * Deer Activity by state (post-launch A6): each state's approximate peak of the whitetail rut
 * (mule deer and Coues deer in the West and Southwest), with zones where a state's rut runs
 * months apart (the Deep South, Florida, Texas), and the opener of each state's firearms
 * season, since gun pressure pushes deer to move at night for the first days. Dates follow
 * state wildlife agency rut surveys and season calendars and move a few days year to year;
 * the owner's own state always comes from admin (`deer_seasons`). Pure.
 */
export type Rut = { pre: string; peak: string; post: string; end: string };

/** Peak rut as month-day; a function picks the zone by place. */
const PEAK: Record<string, string | ((lat: number, lon: number) => string)> = {
  ME: "11-15",
  NH: "11-15",
  VT: "11-15",
  MA: "11-15",
  RI: "11-15",
  CT: "11-15",
  NY: "11-14",
  NJ: "11-12",
  PA: "11-12",
  DE: "11-12",
  MD: "11-10",
  DC: "11-10",
  WV: "11-12",
  VA: "11-10",
  OH: "11-10",
  MI: "11-12",
  IN: "11-12",
  IL: "11-12",
  WI: "11-10",
  MN: "11-10",
  IA: "11-12",
  MO: "11-15",
  ND: "11-15",
  SD: "11-15",
  NE: "11-15",
  KS: "11-15",
  KY: "11-15",
  TN: "11-20",
  OK: "11-18",
  NC: "11-05",
  SC: (lat) => (lat < 33.5 ? "10-20" : "11-01"),
  GA: (lat) => (lat < 31.8 ? "11-20" : "11-05"),
  // South Florida breeds in summer, the Panhandle in winter.
  FL: (lat, lon) =>
    lat < 27 ? "08-10" : lat < 29 ? "10-01" : lon < -84 ? "01-25" : "11-15",
  AL: (lat) => (lat > 33.5 ? "12-20" : "01-20"),
  MS: (lat) => (lat > 33 ? "12-05" : "01-05"),
  LA: (lat, lon) => (lat > 31 ? "11-25" : lon > -91.5 ? "01-10" : "10-20"),
  AR: (lat) => (lat < 34 ? "11-25" : "11-10"),
  TX: (lat) =>
    lat > 32 ? "11-15" : lat > 29.5 ? "11-10" : lat > 28.5 ? "12-01" : "12-20",
  MT: "11-18",
  WY: "11-20",
  CO: "11-20",
  ID: "11-20",
  UT: "11-20",
  NV: "11-25",
  WA: "11-15",
  OR: "11-10",
  CA: (lat) => (lat < 37 ? "10-15" : "11-01"),
  AZ: "01-10",
  NM: "12-05",
};

const DAY = 86400_000;
const md = (t: number) => new Date(t).toISOString().slice(5, 10);

/** A state's rut windows: two weeks before the peak, the peak fortnight, three weeks after. */
export function rutFor(
  st: string,
  lat: number,
  lon: number,
  own?: { state: string; rut: Rut },
): Rut | null {
  if (own && STATE_NAME[st] === own.state) return own.rut;
  const p = PEAK[st];
  if (!p) return null;
  const peak = typeof p === "string" ? p : p(lat, lon);
  const t = Date.parse(`2001-${peak}T00:00:00Z`);
  return {
    pre: md(t - 14 * DAY),
    peak: md(t - 3 * DAY),
    post: md(t + 11 * DAY),
    end: md(t + 32 * DAY),
  };
}

/** The n-th weekday (0 Sunday) of a month (1-based n), UTC midnight. */
function nth(y: number, m: number, wd: number, n: number) {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return Date.UTC(y, m - 1, 1 + ((wd - first + 7) % 7) + (n - 1) * 7);
}
const thanksgiving = (y: number) => nth(y, 11, 4, 4);

/** Firearms opener by state as a rule of the year (approximate where states vary by zone). */
const OPENER: Record<string, (y: number) => number> = {
  MI: (y) => Date.UTC(y, 10, 15),
  PA: (y) => thanksgiving(y) + 2 * DAY,
  WI: (y) => thanksgiving(y) - 5 * DAY,
  MN: (y) => nth(y, 11, 6, 1),
  NY: (y) => nth(y, 11, 6, 3),
  OH: (y) => thanksgiving(y) + 4 * DAY,
  IN: (y) => nth(y, 11, 6, 2) + 7 * DAY,
  IL: (y) => thanksgiving(y) - 6 * DAY,
  IA: (y) => nth(y, 12, 6, 1),
  MO: (y) => nth(y, 11, 6, 2),
  KY: (y) => nth(y, 11, 6, 2),
  TN: (y) => thanksgiving(y) - 5 * DAY,
  WV: (y) => thanksgiving(y) - 3 * DAY,
  VA: (y) => nth(y, 11, 6, 3),
  MD: (y) => thanksgiving(y) + 2 * DAY,
  NJ: (y) => nth(y, 12, 6, 1),
  KS: (y) => thanksgiving(y) + 6 * DAY,
  NE: (y) => nth(y, 11, 6, 2),
  SD: (y) => thanksgiving(y) - 5 * DAY,
  ND: (y) => nth(y, 11, 5, 1) + 7 * DAY,
  OK: (y) => thanksgiving(y) - 5 * DAY,
  TX: (y) => nth(y, 11, 6, 1),
  AR: (y) => nth(y, 11, 6, 2),
  AL: (y) => thanksgiving(y) - 5 * DAY,
  MS: (y) => thanksgiving(y) - 5 * DAY,
  GA: (y) => nth(y, 10, 6, 3),
  SC: (y) => Date.UTC(y, 7, 15),
  NC: (y) => thanksgiving(y) - 12 * DAY,
  MT: (y) => nth(y, 10, 6, 4),
  CO: (y) => nth(y, 10, 6, 4),
  WY: (y) => Date.UTC(y, 9, 1),
};

/**
 * How much daylight deer movement is cut by hunting pressure on a day: by a fifth for the
 * opening three days of firearms season, a tenth for the rest of its first ten days, else none.
 */
export function pressureFactor(
  st: string,
  day: number,
  own?: { state: string; seasons: { name: string; start: string }[] },
) {
  const y = new Date(day).getUTCFullYear();
  let open: number | null = null;
  if (own && STATE_NAME[st] === own.state) {
    const gun = own.seasons.find((s) =>
      /gun|firearm|rifle|shotgun/i.test(s.name),
    );
    if (gun) open = Date.parse(`${gun.start}T00:00:00Z`);
  }
  open ??= OPENER[st]?.(y) ?? null;
  if (open === null) return 1;
  const since = Math.floor((day - open) / DAY);
  return since < 0 || since > 9 ? 1 : since < 3 ? 0.8 : 0.9;
}

export const STATE_NAME: Record<string, string> = {
  AL: "Alabama",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};
