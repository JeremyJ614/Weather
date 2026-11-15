/**
 * Data-decode headings (post-launch A5 "decode"): each page title (`h1[data-decode]`) resolves
 * out of scrambling characters, left to right, in about two thirds of a second, once per
 * page, like a feed coming in. A plain inline script in the page shell, so it costs no
 * JavaScript bundle on any page. The scramble is a copy laid over the title (the real title
 * is held invisible meanwhile and never changes), placed in <body> after load, so React's
 * markup and screen readers are untouched. Skipped for low-tier phones and Reduce Motion;
 * client-side page changes get it too (a new title appears).
 */
export const decodeBootScript = `(function(){try{
if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
var G="▚▞▛▜▙▟01#%/<>*+=",done=new WeakSet();
function run(h){if(done.has(h)||document.documentElement.dataset.tier==="low")return;done.add(h);
var t=h.textContent||"";if(!t.trim())return;var r=h.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;
var cs=getComputedStyle(h),o=document.createElement("div");o.setAttribute("aria-hidden","true");
["font","letterSpacing","textTransform","color","textShadow","lineHeight","textAlign","wordSpacing"].forEach(function(k){o.style[k]=cs[k]});
o.style.cssText+=";position:absolute;margin:0;pointer-events:none;z-index:5;white-space:pre-wrap;padding:"+cs.padding+";left:"+(r.left+scrollX)+"px;top:"+(r.top+scrollY)+"px;width:"+r.width+"px";
document.body.appendChild(o);h.style.opacity="0";var t0=performance.now();
function step(n){var p=Math.min(1,(n-t0)/650),k=Math.floor(p*t.length),s="";for(var i=0;i<t.length;i++){var c=t[i];s+=i<k||c===" "?c:G[(Math.random()*G.length)|0]}o.textContent=s;
if(p<1)requestAnimationFrame(step);else{h.style.opacity="";o.remove()}}requestAnimationFrame(step)}
function scan(){document.querySelectorAll("h1[data-decode]").forEach(run)}
function start(){setTimeout(function(){scan();var q=0;new MutationObserver(function(){if(q)return;q=requestAnimationFrame(function(){q=0;scan()})}).observe(document.body,{childList:true,subtree:true})},120)}
if(document.readyState==="complete")start();else addEventListener("load",start,{once:true});
}catch(e){}})()`;
