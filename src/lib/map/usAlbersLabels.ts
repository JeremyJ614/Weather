import "server-only";
import states from "./data/usStatesAlbers.json";

// State name → 2-letter abbreviation, for on-map labels.
export const STATE_ABBR: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  "District of Columbia": "DC",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
  "Puerto Rico": "PR",
};

// Area-weighted-ish centroid of an SVG path (average of its vertices, largest ring wins),
// used to place a small state abbreviation label. Computed once from the projected paths.
function pathCentroid(d: string): { x: number; y: number } {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  let sx = 0,
    sy = 0,
    n = 0;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    sx += nums[i];
    sy += nums[i + 1];
    n++;
  }
  return n ? { x: sx / n, y: sy / n } : { x: 0, y: 0 };
}

export interface StateLabel {
  abbr: string;
  x: number;
  y: number;
}
export const US_STATE_LABELS: StateLabel[] = (
  states as { states: { name: string; d: string }[] }
).states
  .map((s) => {
    const abbr = STATE_ABBR[s.name];
    if (!abbr) return null;
    const c = pathCentroid(s.d);
    return { abbr, x: c.x, y: c.y };
  })
  .filter((l): l is StateLabel => l !== null);
