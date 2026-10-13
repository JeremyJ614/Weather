/** How warnings are ranked, colored and tagged (VIP's priority order, NWS's map colors). */

export const PRIORITY: Record<string, number> = {
  "Tornado Warning": 1,
  "Flash Flood Warning": 3,
  "Hurricane Warning": 2,
  "Typhoon Warning": 2,
  "Extreme Wind Warning": 2,
  "Storm Surge Warning": 3,
  "Severe Thunderstorm Warning": 4,
  "Tropical Storm Warning": 4,
  "Blizzard Warning": 6,
  "Ice Storm Warning": 6,
  "Winter Storm Warning": 7,
  "Flood Warning": 8,
  "High Wind Warning": 9,
  "Excessive Heat Warning": 9,
  "Extreme Heat Warning": 9,
  "Dust Storm Warning": 10,
  "Fire Warning": 10,
  "Red Flag Warning": 11,
  "Tornado Watch": 12,
  "Severe Thunderstorm Watch": 13,
  "Hurricane Watch": 13,
  "Winter Weather Advisory": 15,
  "Wind Advisory": 16,
  "Flood Advisory": 17,
};

/** NWS's own warning-map colors. */
export const COLOR: Record<string, string> = {
  "Tornado Warning": "#ff0000",
  "Severe Thunderstorm Warning": "#ffa500",
  "Flash Flood Warning": "#8b0000",
  "Flood Warning": "#00ff00",
  "Flood Advisory": "#00ff7f",
  "Flood Watch": "#2e8b57",
  "Tornado Watch": "#ffff00",
  "Severe Thunderstorm Watch": "#db7093",
  "Hurricane Warning": "#dc143c",
  "Hurricane Watch": "#ff00ff",
  "Tropical Storm Warning": "#b22222",
  "Tropical Storm Watch": "#f08080",
  "Storm Surge Warning": "#b524f7",
  "Extreme Wind Warning": "#ff8c00",
  "Blizzard Warning": "#ff4500",
  "Winter Storm Warning": "#ff69b4",
  "Winter Storm Watch": "#4682b4",
  "Ice Storm Warning": "#8b008b",
  "Winter Weather Advisory": "#7b68ee",
  "High Wind Warning": "#daa520",
  "Wind Advisory": "#d2b48c",
  "Red Flag Warning": "#ff1493",
  "Fire Weather Watch": "#ffdead",
  "Excessive Heat Warning": "#c71585",
  "Extreme Heat Warning": "#c71585",
  "Heat Advisory": "#ff7f50",
  "Dense Fog Advisory": "#708090",
  "Special Weather Statement": "#ffe4b5",
  "Freeze Warning": "#483d8b",
  "Frost Advisory": "#6495ed",
  "Hard Freeze Warning": "#9400d3",
  "Freeze Watch": "#00ffff",
  "Hydrologic Outlook": "#90ee90",
  "Coastal Flood Warning": "#228b22",
  "Coastal Flood Advisory": "#7cfc00",
  "Coastal Flood Watch": "#66cdaa",
  "Lakeshore Flood Warning": "#228b22",
  "Lakeshore Flood Advisory": "#7cfc00",
  "High Wind Watch": "#b8860b",
  "Extreme Cold Warning": "#0000ff",
  "Cold Weather Advisory": "#afeeee",
  "Lake Effect Snow Warning": "#008b8b",
  "Air Quality Alert": "#808080",
  "Dense Smoke Advisory": "#f0e68c",
  "Excessive Heat Watch": "#800000",
  "Extreme Heat Watch": "#800000",
};

export const colorOf = (event: string) => COLOR[event] ?? "#9aa3b2";
export const rankOf = (event: string) => PRIORITY[event] ?? 99;

/** Marine-only products (exact NWS names), left off the land warnings list. */
const MARINE = new Set([
  "Small Craft Advisory",
  "Small Craft Advisory For Hazardous Seas",
  "Small Craft Advisory For Rough Bar",
  "Small Craft Advisory For Winds",
  "Gale Warning",
  "Gale Watch",
  "Storm Warning",
  "Storm Watch",
  "Hurricane Force Wind Warning",
  "Hurricane Force Wind Watch",
  "Special Marine Warning",
  "Marine Weather Statement",
  "Hazardous Seas Warning",
  "Hazardous Seas Watch",
  "Heavy Freezing Spray Warning",
  "Heavy Freezing Spray Watch",
  "Freezing Spray Advisory",
  "Low Water Advisory",
  "Brisk Wind Advisory",
  "Rip Current Statement",
  "Beach Hazards Statement",
  "High Surf Advisory",
  "High Surf Warning",
]);
export const isMarine = (event: string) => MARINE.has(event);

/** The danger tags NWS attaches, worded for people. */
export function tags(params: Record<string, string | undefined>) {
  const out: { label: string; level: 1 | 2 | 3 }[] = [];
  const t = (params.tornadoDamageThreat ?? "").toUpperCase();
  const s = (params.thunderstormDamageThreat ?? "").toUpperCase();
  const f = (params.flashFloodDamageThreat ?? "").toUpperCase();
  if (t === "CATASTROPHIC") out.push({ label: "Tornado Emergency", level: 3 });
  else if (t === "CONSIDERABLE") out.push({ label: "PDS", level: 2 });
  if ((params.tornadoDetection ?? "").toUpperCase() === "OBSERVED")
    out.push({ label: "Tornado observed", level: 2 });
  if (s === "DESTRUCTIVE") out.push({ label: "Destructive", level: 3 });
  else if (s === "CONSIDERABLE")
    out.push({ label: "Considerable damage", level: 2 });
  if (f === "CATASTROPHIC")
    out.push({ label: "Flash Flood Emergency", level: 3 });
  else if (f === "CONSIDERABLE")
    out.push({ label: "Considerable flooding", level: 2 });
  if (params.maxHailSize && Number(params.maxHailSize) >= 2)
    out.push({ label: `${params.maxHailSize}" hail`, level: 2 });
  if (
    params.maxWindGust &&
    /\d/.test(params.maxWindGust) &&
    parseInt(params.maxWindGust) >= 80
  )
    out.push({ label: `${params.maxWindGust} gusts`, level: 2 });
  return out;
}

/** Two-letter states named in a UGC list (e.g. "OKC109" → "OK"). */
export const statesOf = (ugc: string[] = []) =>
  [...new Set(ugc.map((u) => u.slice(0, 2)))].sort();

/** NWS alert ids are CAP OIDs with a hex hash, e.g. urn:oid:2.49.0.1.840.0.9fa2….001.1 */
export const isAlertId = (id: string) => /^urn:oid:[0-9a-f.]+$/i.test(id);
