/**
 * Holographic tilt for plan and offer cards (post-launch A5 "holo", B6), alongside the badge
 * plates' own: any element marked `data-holo` tilts in 3D toward the finger or pointer, or with
 * the phone's own tilt while on screen, and a foil sheen slides across it (globals.css). Sets
 * three CSS variables only; the motion is transform and opacity. A plain inline script.
 */
export const holoBootScript = `(function(){try{
if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
var raf=0,todo=[];
function put(el,x,y,o){todo.push([el,x,y,o]);if(!raf)raf=requestAnimationFrame(function(){raf=0;var t=todo;todo=[];
for(var i=0;i<t.length;i++){var s=t[i][0].style;s.setProperty("--hx",t[i][1].toFixed(3));s.setProperty("--hy",t[i][2].toFixed(3));s.setProperty("--ho",t[i][3])}})}
function low(){return document.documentElement.dataset.tier==="low"}
addEventListener("pointermove",function(e){if(low())return;var el=e.target&&e.target.closest&&e.target.closest("[data-holo]");if(!el)return;
var r=el.getBoundingClientRect();put(el,Math.max(-1,Math.min(1,((e.clientX-r.left)/r.width)*2-1)),Math.max(-1,Math.min(1,((e.clientY-r.top)/r.height)*2-1)),1)},{passive:true});
addEventListener("pointerout",function(e){var el=e.target&&e.target.closest&&e.target.closest("[data-holo]");if(el&&!el.contains(e.relatedTarget))put(el,0,0,0)},{passive:true});
var b0=null;
addEventListener("deviceorientation",function(e){if(low()||e.gamma==null||e.beta==null)return;if(b0===null)b0=e.beta;
var x=Math.max(-1,Math.min(1,e.gamma/25)),y=Math.max(-1,Math.min(1,(e.beta-b0)/25));
var all=document.querySelectorAll("[data-holo]");for(var i=0;i<all.length;i++){var r=all[i].getBoundingClientRect();if(r.bottom>0&&r.top<innerHeight)put(all[i],x,y,0.85)}},{passive:true});
}catch(e){}})()`;
