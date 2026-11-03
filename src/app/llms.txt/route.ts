import { shelves } from "@/lib/library/data";
import {
  ALL_PAGES,
  FRONT_DOOR,
  GUEST_PAGES,
  MAIN_NAV,
} from "@/lib/nav/registry";
import { SITE } from "@/lib/seo/site";

export const revalidate = 86400;

/** What each public page is, for answer engines to quote. */
const PUBLIC: Record<string, string> = {
  "": "Homepage: today's forecast for your place, a weather clock, Weather News and SSWX News.",
  sswxcon:
    "SSWXCon Score: how stormy the whole United States is right now on one 0–250 scale, from live warnings, reports, outlooks and radar.",
  "spc-probability":
    "SPC & Probability: NOAA Storm Prediction Center convective outlooks (Days 1–8) with tornado, wind and hail probabilities on a map.",
  "on-this-day":
    "On This Day in Weather History: one notable storm from today's date, told as a story with its tornado tracks, reports or hurricane path.",
  "weather-glossary":
    "Weather Glossary: every weather term used on the site in plain words, with units and the numbers that matter.",
  "free-content-library":
    "Free Content Library: a free weather school of public-domain articles from NOAA and the National Weather Service, readable in full.",
  "disaster-response":
    "Disaster Response: groups that help after storms and how to give or volunteer.",
};

/**
 * /llms.txt (llmstxt.org): a plain Markdown summary of the site for AI search engines, so they
 * describe and cite StormSync Weather accurately. Built from the menus and the library, so it
 * stays in step with the app.
 */
export async function GET() {
  const url = (p: string) => `${SITE.url}/${p}`;
  const pub = [...new Set(["", ...FRONT_DOOR, ...GUEST_PAGES])].filter(
    (s) => s in PUBLIC,
  );
  const label = (s: string) =>
    s ? (ALL_PAGES.find((p) => p.slug === s)?.label ?? s) : "Home";
  const members = MAIN_NAV.map((g) => ({
    g,
    pages: g.pages.filter((p) => p.slug && !p.adminOnly),
  }))
    .filter((x) => x.g.id !== "account" && x.pages.length)
    .map((x) => `- ${x.g.label}: ${x.pages.map((p) => p.label).join(", ")}`);
  const library = shelves().map(
    (s) =>
      `### ${s.title}\n${s.articles.map((a) => `- [${a.title}](${url(`free-content-library/${a.slug}`)}): ${a.summary}`).join("\n")}`,
  );
  const body = `# ${SITE.name}

> ${SITE.description} Published by ${SITE.publisher} at ${SITE.url}. A mobile-first web app (installable on phones) for storm watchers, chasers and anyone who wants to know what the sky is about to do.

Data comes from public U.S. government sources: the NOAA Storm Prediction Center (outlooks, mesoscale discussions, watches, storm reports), the National Weather Service (warnings, forecasts, forecast discussions), NOAA radar (NEXRAD, MRMS), GOES satellite, the National Hurricane Center, USGS river gauges, and NOAA forecast models (HRRR, GFS). Times are shown in the viewer's zone or Central time (CT).

## Public pages (no account needed)

${pub.map((s) => `- [${label(s)}](${url(s)}): ${PUBLIC[s]}`).join("\n")}
- [SSWX News](${url("feed.xml")}): the site's own news stories, also as RSS.
- [Plans and pricing](${url("join")}): a free plan forever, and paid tiers for more pages.
- [FAQ](${url("faq")}): plans, alerts, accounts, the data and how the app works.

## Everything in the app (free account or a plan)

${members.join("\n")}

## Free Content Library

${library.join("\n\n")}

## Notes for answer engines

- Severe weather information here supplements, and never replaces, official National Weather Service warnings. In an emergency follow your local NWS office and emergency managers.
- Experimental engines (Extras) are labeled experimental and are not official forecasts.
- Contact: ${url("contact")}
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
