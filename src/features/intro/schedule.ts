/** When the launch intro plays. Users change this in account settings. */
export type IntroPref = "always" | "daily" | "first" | "off";

export const INTRO_DEFAULT: IntroPref = "daily";

export function parsePref(v: string | null | undefined): IntroPref {
  return v === "always" || v === "daily" || v === "first" || v === "off"
    ? v
    : INTRO_DEFAULT;
}

/** Local calendar day, so "once a day" follows the user's own midnight. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shouldPlay(
  pref: IntroPref,
  lastPlayed: string | null,
  now: Date,
): boolean {
  switch (pref) {
    case "off":
      return false;
    case "always":
      return true;
    case "first":
      return !lastPlayed;
    case "daily":
      return lastPlayed !== dayKey(now);
  }
}

/**
 * Inline script for <head>: decides before first paint so the intro covers the
 * page from the very first frame (or never shows at all). Mirrors shouldPlay, and
 * also plays on the installed app's first launch (it shares storage with the browser,
 * so a same-day browser visit would otherwise have used up the day's play).
 */
export const introBootScript = `(function(){try{var p=localStorage.getItem("sswx-intro")||"daily",l=localStorage.getItem("sswx-intro-last"),d=new Date(),k=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"),play=p==="always"||(p==="first"&&!l)||(p!=="off"&&p!=="always"&&p!=="first"&&l!==k);var app=matchMedia("(display-mode: standalone)").matches||navigator.standalone;if(app&&p!=="off"&&!localStorage.getItem("sswx-intro-app")){play=true;localStorage.setItem("sswx-intro-app","1")}if(play)document.documentElement.dataset.intro="play"}catch(e){}})()`;
