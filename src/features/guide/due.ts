/** When the guides are due. Tiny: the guest gate and the layout's guide host import it. */
export const SHOWCASE_LAST = "sswx-showcase-last";
export const TOUR_KEY = "sswx-tour";
const WEEK = 7 * 864e5;

/** Guests see the showcase on their first visit and again a week after the last one. */
export function showcaseDue(now = Date.now()) {
  try {
    const last = Number(localStorage.getItem(SHOWCASE_LAST)) || 0;
    return now - last >= WEEK;
  } catch {
    return false;
  }
}

/** Bumped with each batch of "What's new": members who toured see the new items once. */
export const NEWS_KEY = "sswx-news";
export const NEWS_EDITION = "2026-10-27";

/** A member who toured before an edition gets its short "What's new" (once per device). */
export function newsDue() {
  try {
    return localStorage.getItem(NEWS_KEY) !== NEWS_EDITION;
  } catch {
    return false;
  }
}

/** Members get the tour once (the account remembers it across devices). */
export function tourDue() {
  try {
    return localStorage.getItem(TOUR_KEY) !== "done";
  } catch {
    return false;
  }
}
