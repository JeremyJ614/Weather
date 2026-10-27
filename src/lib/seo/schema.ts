import { SITE } from "./site";

const abs = (path: string) => new URL(path, SITE.url).toString();
const ORG = `${SITE.url}/#organization`;

/** Who publishes the site, the site itself and the app it is (every page). */
export const siteGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORG,
      name: SITE.publisher,
      url: SITE.url,
      logo: abs(SITE.logo),
      sameAs: SITE.sameAs,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      name: SITE.name,
      url: SITE.url,
      description: SITE.description,
      publisher: { "@id": ORG },
      inLanguage: "en-US",
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE.url}/#app`,
      name: SITE.name,
      url: SITE.url,
      description: SITE.description,
      applicationCategory: "WeatherApplication",
      operatingSystem: "Any (web browser)",
      browserRequirements: "A modern browser with JavaScript",
      publisher: { "@id": ORG },
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "Live radar, MRMS and satellite loops",
        "SPC convective outlooks and probabilities",
        "Warnings and storm reports on a live map",
        "Tropical outlook with cones and recon",
        "Storm chasing outlook and chase log",
        "Experimental weather engines on live NOAA data",
        "Weather glossary and a free weather school",
      ],
    },
  ],
};

/** A FAQ as FAQPage rich results. */
export const faqPage = (items: { q: string; a: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((x) => ({
    "@type": "Question",
    name: x.q,
    acceptedAnswer: { "@type": "Answer", text: x.a },
  })),
});

/** A story or article, with its publisher. */
export const articleOf = (a: {
  path: string;
  title: string;
  description: string;
  published?: string;
  image?: string | null;
  kind?: "NewsArticle" | "Article";
}) => ({
  "@context": "https://schema.org",
  "@type": a.kind ?? "Article",
  headline: a.title.slice(0, 110),
  description: a.description,
  url: abs(a.path),
  mainEntityOfPage: abs(a.path),
  ...(a.published && { datePublished: a.published }),
  ...(a.image && { image: [a.image] }),
  publisher: { "@id": ORG, "@type": "Organization", name: SITE.publisher },
  author: { "@type": "Organization", name: SITE.publisher },
});

/** A glossary as a set of defined terms. */
export const termSet = (
  terms: { term: string; desc: string; id?: string }[],
) => ({
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  name: "Weather Glossary",
  url: abs("/weather-glossary"),
  hasDefinedTerm: terms.map((t) => ({
    "@type": "DefinedTerm",
    name: t.term,
    description: t.desc,
    ...(t.id && { url: abs(`/weather-glossary#${t.id}`) }),
  })),
});
