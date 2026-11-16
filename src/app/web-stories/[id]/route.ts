import { storyById, type Slide } from "@/lib/stories/build";
import { SITE } from "@/lib/seo/site";

/** One Web Story as AMP (B8): Google lists these in Search and Discover. */
export const revalidate = 900;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const BOILER =
  "<style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style><noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>";

const CSS = `amp-story{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#eceef5}
amp-story-page{background:#0b0c14}
.pad{padding:28px 24px 40px;align-content:end}
.top{align-content:start;padding-top:56px}
.eb{color:#d9b76f;font-size:14px;letter-spacing:.12em;text-transform:uppercase;font-weight:700}
h1{font-size:40px;line-height:1.05;margin:8px 0;font-weight:800}
h2{font-size:28px;line-height:1.1;margin:0 0 10px;font-weight:800;color:#d9b76f}
p{font-size:20px;line-height:1.4;margin:0}
.sub{font-size:20px;color:#d9b76f;font-weight:700}
.shade{background:linear-gradient(180deg,rgba(11,12,20,0) 35%,rgba(11,12,20,.92) 75%)}
.card{background:rgba(19,20,31,.92);border:1px solid #3a3320;border-radius:18px;padding:18px}
.fact{border-top:1px solid #23253a;padding:12px 0}.fact b{display:block;font-size:30px;color:#d9b76f}.fact small{color:#8f92a8;font-size:15px}
.brand{font-size:13px;color:#8f92a8;letter-spacing:.08em;text-transform:uppercase}`;

function page(s: Slide, i: number) {
  const id = `p${i}`;
  switch (s.kind) {
    case "cover":
      return `<amp-story-page id="${id}"><amp-story-grid-layer template="fill"><amp-img src="${esc(s.img)}" width="720" height="1280" layout="responsive" alt=""></amp-img></amp-story-grid-layer><amp-story-grid-layer template="fill" class="shade"></amp-story-grid-layer><amp-story-grid-layer template="vertical" class="pad"><div animate-in="fly-in-bottom"><div class="eb">${esc(s.eyebrow)}</div><h1>${esc(s.title)}</h1><div class="sub">${esc(s.sub)}</div></div><div class="brand">StormSync Weather</div></amp-story-grid-layer></amp-story-page>`;
    case "image":
      return s.h > s.w
        ? `<amp-story-page id="${id}"><amp-story-grid-layer template="fill"><amp-img src="${esc(s.img)}" width="${s.w}" height="${s.h}" layout="responsive" alt="${esc(s.title)}"></amp-img></amp-story-grid-layer><amp-story-grid-layer template="fill" class="shade"></amp-story-grid-layer><amp-story-grid-layer template="vertical" class="pad"><div class="card" animate-in="fade-in"><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p></div></amp-story-grid-layer></amp-story-page>`
        : `<amp-story-page id="${id}"><amp-story-grid-layer template="vertical" class="top"><h2 animate-in="fly-in-left">${esc(s.title)}</h2><amp-img src="${esc(s.img)}" width="${s.w}" height="${s.h}" layout="responsive" alt="${esc(s.title)}" animate-in="fade-in"></amp-img><p animate-in="fade-in" animate-in-delay="0.3s">${esc(s.text)}</p></amp-story-grid-layer></amp-story-page>`;
    case "text":
      return `<amp-story-page id="${id}"><amp-story-grid-layer template="vertical" class="pad"><div class="card" animate-in="fly-in-bottom">${s.title ? `<h2>${esc(s.title)}</h2>` : ""}<p>${esc(s.text)}</p></div></amp-story-grid-layer></amp-story-page>`;
    case "facts":
      return `<amp-story-page id="${id}"><amp-story-grid-layer template="vertical" class="top"><h2 animate-in="fly-in-left">${esc(s.title)}</h2>${s.facts
        .map(
          (f, k) =>
            `<div class="fact" animate-in="fade-in" animate-in-delay="${(0.15 * k).toFixed(2)}s"><b>${esc(f.value)}</b>${esc(f.label)}${f.note ? `<br><small>${esc(f.note)}</small>` : ""}</div>`,
        )
        .join("")}</amp-story-grid-layer></amp-story-page>`;
    case "cta":
      return `<amp-story-page id="${id}"><amp-story-grid-layer template="vertical" class="pad"><div class="card" animate-in="zoom-in"><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p></div></amp-story-grid-layer><amp-story-page-outlink layout="nodisplay" theme="dark"><a href="${esc(s.href)}">${esc(s.label)}</a></amp-story-page-outlink></amp-story-page>`;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const st = await storyById(id);
  if (!st) return new Response("No story here", { status: 404 });
  const url = `${SITE.url}/web-stories/${st.id}`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: st.title,
    description: st.description,
    image: [st.poster],
    datePublished: st.published,
    mainEntityOfPage: url,
    publisher: {
      "@type": "Organization",
      name: SITE.publisher,
      logo: { "@type": "ImageObject", url: `${SITE.url}/icons/icon-192.png` },
    },
  };
  const html = `<!doctype html><html ⚡ lang="en"><head><meta charset="utf-8"><title>${esc(st.title)}</title><link rel="canonical" href="${url}"><meta name="viewport" content="width=device-width"><meta name="description" content="${esc(st.description)}">${BOILER}<script async src="https://cdn.ampproject.org/v0.js"></script><script async custom-element="amp-story" src="https://cdn.ampproject.org/v0/amp-story-1.0.js"></script><script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script><style amp-custom>${CSS}</style></head><body><amp-story standalone title="${esc(st.title)}" publisher="${esc(SITE.name)}" publisher-logo-src="${SITE.url}/icons/icon-192.png" poster-portrait-src="${esc(st.poster)}">${st.slides.map(page).join("")}</amp-story></body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": `public, s-maxage=${id === "severe-today" ? 900 : 604800}, stale-while-revalidate=86400`,
    },
  });
}
