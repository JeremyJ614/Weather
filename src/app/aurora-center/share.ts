import { card } from "@/features/share/card";

/**
 * The Aurora Center map's share card (owner, 2026-11-13): Kp on a lit dial, the live oval in
 * its frame with the key, and how to read it. Loaded when someone taps Download or Share.
 */
export async function auroraCard(o: {
  shot: HTMLCanvasElement;
  accent: string;
  kp: number | null;
  band: { g: string; label: string; desc: string } | null;
  kpColor: string;
  peak: number;
  forecast: string | null;
  legend: [string, string][];
}) {
  const c = await card(
    "Aurora Forecast",
    o.forecast
      ? `The northern lights oval for ${o.forecast}`
      : "The northern lights oval",
    o.accent,
  );
  if (o.kp != null && o.band)
    c.hero({
      frac: o.kp / 9,
      color: o.kpColor,
      big: o.kp.toFixed(1),
      small: "Kp now",
      kicker: "Geomagnetic activity",
      name: o.band.g === "G0" ? o.band.label : `${o.band.g} ${o.band.label}`,
      body: `${o.band.desc}${o.peak ? ` Forecast peak in the next 15 hours: Kp ${o.peak.toFixed(1)}.` : ""}`,
    });
  c.frame(o.shot, 1000);
  c.legend(o.legend);
  c.panel("How to read the map", null, () => {
    c.text(
      "Color is NOAA's OVATION chance of aurora directly overhead. North of the view line, a strong display can be seen low on the northern horizon; the farther north, the higher it climbs.",
      { size: 21, alpha: 0.88 },
    );
    c.gap(10);
    c.label("Seeing it");
    c.bullets([
      "Get away from town lights and face north once it's fully dark.",
      "Give your eyes 20 minutes; a phone camera on night mode catches what eyes miss.",
      "Kp is the planet-wide average; the oval is the 30-minute forecast that counts.",
    ]);
  });
  return c.finish(
    "Source: NOAA Space Weather Prediction Center (OVATION Prime 30-minute forecast and planetary Kp).",
  );
}
