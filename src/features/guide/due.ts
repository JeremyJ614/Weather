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

/** Members get the tour once (the account remembers it across devices). */
export function tourDue() {
  try {
    return localStorage.getItem(TOUR_KEY) !== "done";
  } catch {
    return false;
  }
}
