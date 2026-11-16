/**
 * Card grows into the page, everywhere (post-launch A5 "card-morph", B6): when a card, list row
 * or menu item that links to another page is tapped, it is named for the page change and grows
 * out to fill the screen while the new page fades in (`::view-transition-old(tap-card)` in
 * globals.css). Named pairs (news, library, page headers) still morph exactly. A plain inline
 * script, so no bundle cost; off without View Transitions, on low tier and with Reduce Motion.
 */
export const tapMorphBootScript = `(function(){try{
if(!document.startViewTransition||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
var last=null;
addEventListener("click",function(e){
if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
if(document.documentElement.dataset.tier==="low")return;
var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a||a.target==="_blank"||a.hasAttribute("download"))return;
var u=new URL(a.href,location.href);if(u.origin!==location.origin||(u.pathname===location.pathname))return;
if(a.closest("[data-no-morph],header nav"))return;
var c=a.closest(".panel,[class*='__card'],[class*='Card'],li")||a;
if(c===document.body||c.getBoundingClientRect().height>innerHeight*0.8)c=a;
if(last)last.style.viewTransitionName="";
c.style.viewTransitionName="tap-card";last=c;
setTimeout(function(){if(last===c){c.style.viewTransitionName="";last=null}},1600);
},true);
}catch(e){}})()`;
