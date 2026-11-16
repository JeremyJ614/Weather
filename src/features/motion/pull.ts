/**
 * Tornado pull-to-refresh (post-launch A5 "pull-funnel"): in the installed app, and (B6) in phone
 * browsers too, where the browser's own pull is switched off (`overscroll-behavior-y`) so ours
 * takes its place: pull down at the top of a page and a small funnel
 * forms from the top edge, tightening as you pull; let go past the line and it spins while
 * the page reloads (instant reopen keeps that quick). Touches that start on a map, a canvas
 * or a horizontal swipe are left alone. A plain inline script, so no bundle cost. Transform
 * and opacity only; no spin for Reduce Motion.
 */
export const pullBootScript = `(function(){try{
var app=matchMedia("(display-mode: standalone)").matches||navigator.standalone;
if(!app){if(!matchMedia("(pointer: coarse)").matches||!("ontouchstart" in window))return;document.documentElement.style.overscrollBehaviorY="contain";}
var still=matchMedia("(prefers-reduced-motion: reduce)").matches,y0=null,x0=0,d=0,el=null,svg=null,busy=false,LIM=90;
function make(){if(el)return;el=document.createElement("div");el.setAttribute("aria-hidden","true");
el.style.cssText="position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 76px);z-index:60;width:58px;height:58px;margin-left:-29px;display:grid;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--surface) 92%,transparent);border:1px solid var(--lit-line);box-shadow:var(--glow),0 10px 30px -10px #000;pointer-events:none;opacity:0;transform-origin:50% 0;color:var(--accent)";
el.innerHTML='<svg viewBox="0 0 80 90" width="34" height="38" fill="none" style="filter:drop-shadow(0 0 5px color-mix(in srgb,var(--accent) 60%,transparent))" stroke="currentColor" stroke-linecap="round"><g><path d="M6 8Q40 2 74 8" stroke-width="3"/><path d="M14 22Q40 17 66 22" stroke-width="2.6"/><path d="M22 36Q40 32 58 36" stroke-width="2.3"/><path d="M29 50Q40 47 51 50" stroke-width="2"/><path d="M34 63Q40 61 46 63" stroke-width="1.7"/><path d="M37 75Q40 74 43 76" stroke-width="1.4"/></g></svg>';
document.body.appendChild(el);svg=el.querySelector("g")}
function set(v){d=v;make();var k=Math.min(1,v/LIM);el.style.transition="none";el.style.opacity=String(k);el.style.transform="scale("+(0.4+k*0.6)+","+(0.3+k*0.7)+") rotate("+((k-1)*20)+"deg)"}
function reset(){if(!el)return;el.style.transition="transform .3s ease, opacity .3s ease";el.style.opacity="0";el.style.transform="scale(.4,.3)"}
addEventListener("touchstart",function(e){if(busy||scrollY>0||e.touches.length!==1)return;var t=e.target;if(t&&t.closest&&t.closest("canvas,.maplibregl-map,.mapboxgl-map,[data-no-pull],input,textarea,select"))return;y0=e.touches[0].clientY;x0=e.touches[0].clientX;d=0},{passive:true});
addEventListener("touchmove",function(e){if(y0===null)return;var dy=e.touches[0].clientY-y0,dx=Math.abs(e.touches[0].clientX-x0);if(dx>Math.abs(dy)||scrollY>0){y0=null;reset();return}if(dy>8)set(Math.min(130,(dy-8)*0.55))},{passive:true});
addEventListener("touchend",function(){if(y0===null)return;y0=null;if(d<LIM){reset();return}busy=true;
if(!still&&svg){svg.style.transformBox="view-box";svg.style.transformOrigin="40px 40px";svg.animate([{transform:"scaleX(1)"},{transform:"scaleX(-1)"},{transform:"scaleX(1)"}],{duration:500,iterations:Infinity})}
setTimeout(function(){location.reload()},350)},{passive:true});
}catch(e){}})()`;
