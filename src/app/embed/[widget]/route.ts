import { nationalScore } from "@/lib/sswxcon/live";
import { esc, htmlHeaders, shell, themeOf } from "@/lib/embed/page";

/** The embeddable widgets (B7): /embed/sswxcon, /embed/outlook, /embed/radar, /embed/local. */
export const revalidate = 600;

const RISK: Record<string, [string, string]> = {
  TSTM: ["General thunderstorms", "#7ec980"],
  MRGL: ["Marginal risk", "#3f9a4f"],
  SLGT: ["Slight risk", "#e8c64c"],
  ENH: ["Enhanced risk", "#e88f3c"],
  MDT: ["Moderate risk", "#e2463c"],
  HIGH: ["High risk", "#e04bd2"],
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ widget: string }> },
) {
  const { widget } = await params;
  const q = new URL(req.url).searchParams;
  const theme = themeOf(q.get("theme"));

  if (widget === "sswxcon") {
    const n = await nationalScore().catch(() => null);
    const body = n
      ? `<span class="top"><span class="eb">SSWXCon Score · U.S.</span><span class="pill" style="color:${n.band.color}">${esc(n.band.label)}</span></span>
<span class="big" style="color:${n.band.color}">${n.total}<span class="muted"> / 250</span></span>
<span class="bar"><i style="background:${n.band.color};transform:scaleX(${Math.min(1, n.total / 250).toFixed(3)})"></i></span>
<span class="muted">${esc(n.drivers?.[0] ?? `${n.alertCount} active alerts`)}</span>`
      : `<span class="eb">SSWXCon Score</span><span class="muted">The live score is updating. Tap for the full page.</span>`;
    return new Response(
      shell({ title: "SSWXCon Score", theme, body, href: "/sswxcon" }),
      {
        headers: htmlHeaders(600),
      },
    );
  }

  if (widget === "outlook") {
    const r = await fetch(
      "https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson",
      { next: { revalidate: 600 }, signal: AbortSignal.timeout(15000) },
    ).catch(() => null);
    const d = r?.ok
      ? ((await r.json()) as { features: { properties: { LABEL?: string } }[] })
      : null;
    const order = Object.keys(RISK);
    const top = d?.features
      .map((f) => order.indexOf(String(f.properties.LABEL)))
      .reduce((a, b) => Math.max(a, b), -1);
    const [label, color] =
      top !== undefined && top >= 0
        ? RISK[order[top]]
        : ["No severe risk today", "#94a3b8"];
    const body = `<span class="top"><span class="eb">SPC Day 1 Outlook</span><span class="pill" style="color:${color}">${esc(label)}</span></span>
<img src="https://www.spc.noaa.gov/products/outlook/day1otlk.png" alt="Storm Prediction Center Day 1 categorical outlook map" loading="lazy">`;
    return new Response(
      shell({
        title: "SPC Day 1 Outlook",
        theme,
        body,
        href: "/spc-probability",
      }),
      { headers: htmlHeaders(600) },
    );
  }

  if (widget === "radar") {
    // NWS's own radar loops (public domain): one site, or the whole country.
    const site = (q.get("site") ?? "").toUpperCase();
    const id = /^[KPT][A-Z]{3}$/.test(site) ? site : "CONUS";
    const body = `<span class="top"><span class="eb">Radar loop · ${id === "CONUS" ? "United States" : id}</span><span class="pill" style="color:#7ec980">Live</span></span>
<img src="https://radar.weather.gov/ridge/standard/${id}_loop.gif" alt="${id === "CONUS" ? "National" : esc(id)} radar loop" loading="lazy">`;
    return new Response(
      shell({ title: "Radar loop", theme, body, href: "/radar-model-runs" }),
      { headers: htmlHeaders(86400) },
    );
  }

  if (widget === "local") {
    const lat = Number(q.get("lat"));
    const lon = Number(q.get("lon"));
    const name = (q.get("name") ?? "").slice(0, 40);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      return new Response("Add ?lat=…&lon=… to the address.", { status: 400 });
    const la = lat.toFixed(3);
    const lo = lon.toFixed(3);
    const body = `<span class="top"><span class="eb">${esc(name || "Your weather")}</span><span class="muted" id="t"></span></span>
<span class="big" id="temp">--</span><span class="muted" id="sky">Loading…</span><ul id="al"></ul>`;
    // Runs in the visitor's browser: NWS alerts for the point and Open-Meteo's current conditions.
    const script = `(function(){var C={0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Cloudy",45:"Fog",48:"Fog",51:"Drizzle",53:"Drizzle",55:"Drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",73:"Snow",75:"Heavy snow",80:"Showers",81:"Showers",82:"Heavy showers",95:"Thunderstorms",96:"Thunderstorms with hail",99:"Thunderstorms with hail"};
function $(i){return document.getElementById(i)}
fetch("https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto").then(function(r){return r.json()}).then(function(d){var c=d.current;$("temp").textContent=Math.round(c.temperature_2m)+"°F";$("sky").textContent=(C[c.weather_code]||"")+" · wind "+Math.round(c.wind_speed_10m)+" mph, gusts "+Math.round(c.wind_gusts_10m);$("t").textContent=new Date().toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}).catch(function(){$("sky").textContent="Conditions unavailable"});
fetch("https://api.weather.gov/alerts/active?point=${la},${lo}",{headers:{Accept:"application/geo+json"}}).then(function(r){return r.json()}).then(function(d){var l=$("al"),f=(d.features||[]).slice(0,3);if(!f.length){l.innerHTML='<li style="color:#3f9a4f">No active alerts</li>';return}
f.forEach(function(x){var e=x.properties.event,li=document.createElement("li"),c=/Tornado|Extreme/.test(e)?"#e04bd2":/Warning/.test(e)?"#e2463c":/Watch/.test(e)?"#e8c64c":"#94a3b8";li.innerHTML='<span class="pill" style="color:'+c+'">'+(/Warning/.test(e)?"Warning":/Watch/.test(e)?"Watch":"Alert")+'</span>';li.appendChild(document.createTextNode(e));l.appendChild(li)})}).catch(function(){})})()`;
    return new Response(
      shell({
        title: `${name || "Local"} weather`,
        theme,
        body,
        href: "/",
        script,
      }),
      { headers: htmlHeaders(86400) },
    );
  }

  return new Response("Unknown widget", { status: 404 });
}
