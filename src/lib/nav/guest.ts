/**
 * Paths a guest may request; the proxy sends everything else to the signup gate. Kept apart from
 * the menu registry so the pattern stays out of every page's JavaScript (only the proxy needs it).
 */
export const GUEST_PATHS =
  /^\/(?:$|disaster-response|donate|join|login|signup|welcome|auth|privacy|news|offline|sswxcon|spc-probability|on-this-day|weather-glossary|free-content-library|contact|faq|closed|widgets|embed|web-stories|press|reports|news-sitemap\.xml|api|feed\.xml|sitemap\.xml|robots\.txt|llms\.txt|opengraph-image|twitter-image)(?:\/|$|\?)/;
