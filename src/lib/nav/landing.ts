/**
 * Pages people land on from search or a shared link (the public front door and help): no
 * intro, guest tour or sign-up gate over them; they carry a sign-up card instead. Search
 * engines also count full-screen overlays on arrival against a page.
 */
export const LANDING =
  /^\/(?:widgets|press|reports|web-stories|sswxcon|spc-probability|on-this-day|weather-glossary|free-content-library|news|faq|contact|privacy|disaster-response)(?:\/|$)/;
