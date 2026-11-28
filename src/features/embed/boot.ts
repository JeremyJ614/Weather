import { GRID } from "@/lib/weather/geo";

/**
 * Framing pages inside the owner's other apps, parsed before paint (inline, so it adds no bundle):
 * - `?embed=1` hides the site's header, menus and notices and skips the launch intro;
 *   `?embed=part` shows only the element marked `data-embed-part` (e.g. a map).
 * - `?place=lat,lon,Label` becomes the active place (window.sswxPlace, read by the location
 *   store), shown but not saved, snapped to the same grid as saved places.
 */
export const embedBootScript = `(function(){try{var q=new URLSearchParams(location.search),d=document.documentElement,e=q.get("embed");
if(e){d.dataset.embed=e==="part"?"part":"1";delete d.dataset.intro}
var m=(q.get("place")||"").match(/^(-?\\d{1,2}(?:\\.\\d+)?),(-?\\d{1,3}(?:\\.\\d+)?)(?:,(.{1,60}))?$/);
if(m&&Math.abs(+m[1])<=90&&Math.abs(+m[2])<=180){var r=function(v){return Number((Math.round(v/${GRID})*${GRID}).toFixed(2))},a=r(+m[1]),b=r(+m[2]),id=a+","+b;
window.sswxPlace={list:[{id:id,label:(m[3]||"").trim()||"Pinned place",lat:a,lon:b,source:"search"}],active:id}}}catch(x){}})()`;
