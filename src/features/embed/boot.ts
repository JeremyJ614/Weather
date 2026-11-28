/**
 * Embed mode for framing pages inside the owner's other apps.
 * `?embed=1` shows the page without the site's header, menus and notices;
 * `?embed=part` shows only the element marked `data-embed-part` (e.g. a map).
 * Runs before paint and also stops the launch intro from playing in the frame.
 */
export const embedBootScript = `(function(){try{var e=new URLSearchParams(location.search).get("embed");if(!e)return;var d=document.documentElement;d.dataset.embed=e==="part"?"part":"1";delete d.dataset.intro}catch(x){}})()`;
