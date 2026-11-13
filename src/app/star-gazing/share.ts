import { bitmap, card } from "@/features/share/card";

/**
 * The Star Gazing map's share card (owner, 2026-11-13): your night on a lit dial when there
 * is one, the national map in its frame, the bands and how the score is made.
 */
export async function starsCard(o: {
  map: Blob;
  accent: string;
  title: string;
  legend: [string, string][];
  night: {
    place: string;
    score: number;
    band: string;
    color: string;
    read: string;
    tiles: { k: string; v: string }[];
  } | null;
}) {
  const c = await card("Stargazing Forecast", o.title, o.accent);
  if (o.night) {
    c.hero({
      frac: o.night.score / 100,
      color: o.night.color,
      big: String(o.night.score),
      small: "best tonight",
      kicker: `Tonight · ${o.night.place}`,
      name: o.night.band,
      body: o.night.read,
    });
    c.tiles(o.night.tiles);
  }
  c.frame(await bitmap(o.map), 760);
  c.legend(o.legend);
  c.panel("How the score works", null, () => {
    c.text(
      "Score = darkness × cloud (low, middle and high layers weighed) × moon × air (humidity, haze, rain), from Open-Meteo model forecasts and computed sun and moon positions.",
      { size: 21, alpha: 0.88 },
    );
    c.gap(10);
    c.label("Reading the colors");
    c.bullets([
      "80 and up is pristine: the Milky Way's dust lanes and faint galaxies.",
      "60 to 79 is excellent; 40 to 59 is good for planets, the Moon and bright clusters.",
      "Below 20 the sky is washed out by cloud, moonlight or haze.",
    ]);
  });
  return c.finish(
    "Lower 48 sky forecast from Open-Meteo models; sun and moon computed for each place.",
  );
}
