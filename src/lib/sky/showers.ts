/**
 * The major annual meteor showers (International Meteor Organization working list):
 * the usual peak night and the zenithal hourly rate under a perfect dark sky. Peaks
 * drift by about a day from year to year, so the page says "around".
 */
export const SHOWERS = [
  {
    name: "Quadrantids",
    month: 1,
    day: 3,
    zhr: 110,
    radiant: "Boötes",
    note: "Sharp peak of only a few hours; best before dawn.",
  },
  {
    name: "Lyrids",
    month: 4,
    day: 22,
    zhr: 18,
    radiant: "Lyra",
    note: "Bright, fast meteors; the oldest recorded shower.",
  },
  {
    name: "Eta Aquariids",
    month: 5,
    day: 6,
    zhr: 50,
    radiant: "Aquarius",
    note: "Debris of Halley's Comet; best in the hour before dawn.",
  },
  {
    name: "Southern Delta Aquariids",
    month: 7,
    day: 30,
    zhr: 25,
    radiant: "Aquarius",
    note: "Faint meteors; better the farther south you are.",
  },
  {
    name: "Perseids",
    month: 8,
    day: 12,
    zhr: 100,
    radiant: "Perseus",
    note: "The summer favorite: warm nights, many bright meteors.",
  },
  {
    name: "Draconids",
    month: 10,
    day: 8,
    zhr: 10,
    radiant: "Draco",
    note: "Best in the evening, unlike most showers.",
  },
  {
    name: "Orionids",
    month: 10,
    day: 21,
    zhr: 20,
    radiant: "Orion",
    note: "Halley's Comet again; fast meteors after midnight.",
  },
  {
    name: "Leonids",
    month: 11,
    day: 17,
    zhr: 15,
    radiant: "Leo",
    note: "Famous for rare storms; usually modest.",
  },
  {
    name: "Geminids",
    month: 12,
    day: 14,
    zhr: 150,
    radiant: "Gemini",
    note: "The year's best, active all night from mid-evening.",
  },
  {
    name: "Ursids",
    month: 12,
    day: 22,
    zhr: 10,
    radiant: "Ursa Minor",
    note: "A quiet shower right at the solstice.",
  },
] as const;

/** The next `n` peaks from `from` (peak night taken as 08 UTC, the US early morning). */
export function nextShowers(from: Date, n = 4) {
  const y = from.getUTCFullYear();
  return [y, y + 1]
    .flatMap((year) =>
      SHOWERS.map((s) => ({
        ...s,
        at: new Date(Date.UTC(year, s.month - 1, s.day, 8)),
      })),
    )
    .filter((s) => s.at.getTime() > from.getTime() - 86400_000)
    .slice(0, n);
}
