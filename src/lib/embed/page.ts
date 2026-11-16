import { SITE } from "@/lib/seo/site";

/**
 * Free embeddable widgets (post-launch A9, B7): tiny standalone HTML pages other sites put in an
 * <iframe>. No app shell, no fonts, no bundle: inline CSS and (for the local widget) a few lines
 * of script that read public NOAA and Open-Meteo data in the visitor's own browser, so they
 * cost the server almost nothing. Every widget links back to the full page.
 */
export type Theme = "dark" | "light";
export const themeOf = (v: string | null): Theme =>
  v === "light" ? "light" : "dark";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export { esc };

export function shell(o: {
  title: string;
  theme: Theme;
  body: string;
  href: string;
  script?: string;
}) {
  const dark = o.theme === "dark";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(o.title)}</title><style>
:root{--bg:${dark ? "#0b0f17" : "#ffffff"};--card:${dark ? "#121826" : "#f6f7fb"};--text:${dark ? "#f1f5f9" : "#0f172a"};--muted:${dark ? "#94a3b8" : "#475569"};--line:${dark ? "#243049" : "#d7dce6"};--gold:#e8b64c}
*{box-sizing:border-box;margin:0}html,body{height:100%;background:var(--bg);color:var(--text);font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
a{color:inherit;text-decoration:none}.w{display:flex;flex-direction:column;gap:8px;height:100%;padding:12px 14px;border:1px solid var(--line);border-radius:16px;background:var(--card)}
.top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.eb{color:var(--muted);font-size:11px;letter-spacing:.08em;text-transform:uppercase}
.big{font-weight:800;font-size:30px;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.muted{color:var(--muted);font-size:12px}
.foot{margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px;color:var(--muted)}.foot b{color:var(--gold);font-weight:700}
.pill{display:inline-block;padding:2px 9px;border-radius:999px;font-weight:700;font-size:12px;border:1.5px solid currentColor}
.bar{height:8px;border-radius:99px;background:var(--line);overflow:hidden}.bar i{display:block;height:100%;transform-origin:left;border-radius:99px}
img{display:block;width:100%;height:auto;border-radius:10px}ul{list-style:none;padding:0;display:grid;gap:5px}li{display:flex;gap:8px;align-items:center;font-size:13px}
</style></head><body><a class="w" href="${SITE.url}${o.href}" target="_blank" rel="noopener">${o.body}<span class="foot"><span>Live · tap for more</span><b>StormSync Weather</b></span></a>${o.script ? `<script>${o.script}</script>` : ""}</body></html>`;
}

export const htmlHeaders = (maxAge: number) => ({
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 4}`,
  "X-Robots-Tag": "noindex",
});
