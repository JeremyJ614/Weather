/**
 * Records the National Weather Service reports (Record Event Reports, product RER), read
 * into one shape. Offices write them two ways: a sentence ("A RECORD HIGH TEMPERATURE OF
 * 78 DEGREES WAS SET AT BISMARCK ND TODAY. THIS BREAKS THE OLD RECORD OF 77 DEGREES SET
 * IN 2014.") or a table under a heading ("...LOWEST MAXIMUM TEMPERATURE RECORDS BROKEN OR
 * TIED ON OCT 23 2026..."). Anything else is left out rather than guessed at.
 */
export type RecordType =
  "high" | "low" | "warmLow" | "coldHigh" | "rain" | "snow";

export type WxRecord = {
  type: RecordType;
  place: string;
  /** Two-letter state, from the place or the issuing office. */
  st: string;
  value: string;
  unit: "°F" | "in";
  old: string | null;
  oldYear: string | null;
  tied: boolean;
  /** The day the record fell (YYYY-MM-DD). */
  day: string;
  office: string;
};

export const RECORD_LABEL: Record<RecordType, string> = {
  high: "Record high",
  low: "Record low",
  warmLow: "Warmest low",
  coldHigh: "Coldest high",
  rain: "Record rainfall",
  snow: "Record snowfall",
};

/** Which record a heading or phrase names. */
export function typeOf(phrase: string): RecordType | null {
  const p = phrase.toUpperCase();
  if (/SNOW/.test(p)) return "snow";
  if (/RAIN|PRECIP/.test(p)) return "rain";
  if (/(HIGH|WARM)(EST)? MIN|WARM(EST)? LOW|HIGH LOW/.test(p)) return "warmLow";
  if (/LOW(EST)? MAX|COLD(EST)? HIGH|COOL(EST)? HIGH|LOW HIGH/.test(p))
    return "coldHigh";
  if (/HIGH|MAXIMUM|WARM/.test(p)) return "high";
  if (/LOW|MINIMUM|COLD/.test(p)) return "low";
  return null;
}

const MONTHS = "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split(" ");
const STATE_NAMES: Record<string, string> = {
  ALABAMA: "AL",
  ALASKA: "AK",
  ARIZONA: "AZ",
  ARKANSAS: "AR",
  CALIFORNIA: "CA",
  COLORADO: "CO",
  CONNECTICUT: "CT",
  DELAWARE: "DE",
  FLORIDA: "FL",
  GEORGIA: "GA",
  HAWAII: "HI",
  IDAHO: "ID",
  ILLINOIS: "IL",
  INDIANA: "IN",
  IOWA: "IA",
  KANSAS: "KS",
  KENTUCKY: "KY",
  LOUISIANA: "LA",
  MAINE: "ME",
  MARYLAND: "MD",
  MASSACHUSETTS: "MA",
  MICHIGAN: "MI",
  MINNESOTA: "MN",
  MISSISSIPPI: "MS",
  MISSOURI: "MO",
  MONTANA: "MT",
  NEBRASKA: "NE",
  NEVADA: "NV",
  OHIO: "OH",
  OKLAHOMA: "OK",
  OREGON: "OR",
  PENNSYLVANIA: "PA",
  TENNESSEE: "TN",
  TEXAS: "TX",
  UTAH: "UT",
  VERMONT: "VT",
  VIRGINIA: "VA",
  WASHINGTON: "WA",
  WISCONSIN: "WI",
  WYOMING: "WY",
};
const title = (s: string) =>
  s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** "IMPERIAL NE" → ["Imperial", "NE"]; "ALAMOSA COLORADO" → ["Alamosa", "CO"]. */
function splitPlace(raw: string, fallback: string): [string, string] {
  const p = raw
    .replace(/\s+/g, " ")
    .replace(/[.,]+$/, "")
    .replace(/^THE /, "")
    .trim();
  const m = p.match(/^(.*?)[ ,/]+([A-Z]{2})$/);
  if (m) return [title(m[1]), m[2]];
  for (const [name, ab] of Object.entries(STATE_NAMES))
    if (p.endsWith(` ${name}`))
      return [title(p.slice(0, -name.length - 1)), ab];
  return [title(p), fallback];
}

/** One RER product's records. `issued` is its issuance time (ISO). */
/**
 * One RER product's records. `issued` is its issuance time (ISO); `homeSt` is the issuing
 * office's state, for places the product names without one.
 */
export function parseRer(
  text: string,
  issued: string,
  homeSt = "",
): WxRecord[] {
  const out: WxRecord[] = [];
  const office =
    text.match(
      /NATIONAL WEATHER SERVICE ([A-Z .'/-]+?),? ([A-Z]{2})\s*\n/,
    )?.[0] ?? "";
  const officeSt = office.match(/ ([A-Z]{2})\s*\n$/)?.[1] ?? homeSt;
  const officeName = title(
    office
      .replace(/^NATIONAL WEATHER SERVICE /, "")
      .replace(/,? [A-Z]{2}\s*\n$/, ""),
  );
  // "Today" is the office's own date, from the product's local issuance line.
  const local = text.match(
    /^\d{3,4} [AP]M [A-Z]{3,4} [A-Z]{3} ([A-Z]{3}) (\d{1,2}) (\d{4})/m,
  );
  const lm = local ? MONTHS.indexOf(local[1]) : -1;
  const at =
    local && lm >= 0
      ? new Date(Date.UTC(+local[3], lm, +local[2], 12))
      : new Date(issued);
  const day = (back: number) =>
    new Date(at.getTime() - back * 86400_000).toISOString().slice(0, 10);
  const flat = text.replace(/\s*\n\s*/g, " ");

  // Sentence form, as many as the product holds.
  const re =
    /A (?:NEW )?RECORD ([A-Z ]+?) OF (-?\d+(?:\.\d+)?|TRACE) ?(DEGREES|INCHES|INCH)?[A-Z ()]*? WAS (?:SET|TIED) AT (.+?) (TODAY|YESTERDAY|LAST NIGHT|THIS MORNING|THIS AFTERNOON|ON [A-Z]+ \d{1,2}(?: \d{4})?)\b[^.]*\.\s*THIS (BREAKS|TIES) THE (?:OLD )?RECORD OF (-?\d+(?:\.\d+)?|TRACE)[^.]*?SET IN ((?:\d{4}(?:,| AND| &)? ?)+)/g;
  for (const m of flat.matchAll(re)) {
    const type = typeOf(m[1]);
    if (!type) continue;
    const [place, st] = splitPlace(m[4], officeSt);
    let when = m[5] === "YESTERDAY" ? day(1) : day(0);
    const on = m[5].match(/^ON ([A-Z]+) (\d{1,2})/);
    if (on) {
      const mo = MONTHS.indexOf(on[1].slice(0, 3));
      if (mo >= 0)
        when = `${at.getUTCFullYear()}-${String(mo + 1).padStart(2, "0")}-${on[2].padStart(2, "0")}`;
    }
    out.push({
      type,
      place,
      st,
      value: m[2] === "TRACE" ? "T" : m[2],
      unit: type === "rain" || type === "snow" ? "in" : "°F",
      old: m[7] === "TRACE" ? "T" : m[7],
      oldYear: m[8].trim().replace(/\s+/g, " ").replace(/,$/, ""),
      tied: m[6] === "TIES",
      day: when,
      office: officeName,
    });
  }

  // "ON THURSDAY, OCTOBER 22ND, 2026, THE ... AT MERCED REGIONAL AIRPORT (KMCE) RECORDED
  // PRECIPITATION OF 1.40 INCHES WHICH BREAKS THE PREVIOUS RECORD HIGH DAILY ... OF 0.37".
  const re2 =
    /ON [A-Z]+,? ([A-Z]+) (\d{1,2})(?:ST|ND|RD|TH)?,? (\d{4}),? THE .*? AT (.+?) \([A-Z0-9]{3,5}\) RECORDED (?:AN? )?([A-Z ]*?) ?(?:OF )?(-?\d+(?:\.\d+)?) (DEGREES|INCHES|INCH) WHICH (BREAKS|TIES) THE PREVIOUS RECORD ([A-Z ]+?) OF (-?\d+(?:\.\d+)?) [A-Z]+ THAT WAS (?:LAST )?SET (?:FOR THE DATE )?IN (\d{4})/g;
  for (const m of flat.matchAll(re2)) {
    const type = typeOf(m[9]);
    const mo = MONTHS.indexOf(m[1].slice(0, 3));
    if (!type || mo < 0) continue;
    const [place, st] = splitPlace(m[4], officeSt);
    out.push({
      type,
      place,
      st,
      value: m[6],
      unit: type === "rain" || type === "snow" ? "in" : "°F",
      old: m[10],
      oldYear: m[11],
      tied: m[8] === "TIES",
      day: `${m[3]}-${String(mo + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`,
      office: officeName,
    });
  }

  // Table form: a heading, then one line per place.
  let tableType: RecordType | null = null;
  let tableDay = day(0);
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(
      /^\.\.\.(.+?) RECORDS? (?:BROKEN|SET)(?: OR TIED)?(?: ON ([A-Z]{3}) (\d{1,2}) (\d{4}))?/,
    );
    if (h) {
      tableType = typeOf(h[1]);
      if (h[2]) {
        const mo = MONTHS.indexOf(h[2]);
        if (mo >= 0)
          tableDay = `${h[4]}-${String(mo + 1).padStart(2, "0")}-${h[3].padStart(2, "0")}`;
      }
      continue;
    }
    if (!tableType || /^\s*(LOCATION|\$\$)/.test(line)) continue;
    const r = line.match(
      /^([A-Z][A-Z .'/()-]*?[A-Z)])\s{2,}(-?\d+(?:\.\d+)?|T)\s+(TIED\s+)?(-?\d+(?:\.\d+)?|T)\s+IN\s+(\d{4})/,
    );
    if (!r) continue;
    const [place, st] = splitPlace(r[1], officeSt);
    out.push({
      type: tableType,
      place,
      st,
      value: r[2],
      unit: tableType === "rain" || tableType === "snow" ? "in" : "°F",
      old: r[4],
      oldYear: r[5],
      tied: Boolean(r[3]),
      day: tableDay,
      office: officeName,
    });
  }
  return out;
}

/** Offices reissue reports (corrections, updates): one record per type, place and day. */
export function dedupe(list: WxRecord[]): WxRecord[] {
  const seen = new Map<string, WxRecord>();
  for (const r of list) seen.set(`${r.type}|${r.place}|${r.st}|${r.day}`, r);
  return [...seen.values()].sort(
    (a, b) => b.day.localeCompare(a.day) || a.place.localeCompare(b.place),
  );
}
