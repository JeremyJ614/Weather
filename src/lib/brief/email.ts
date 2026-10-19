import { aqiBand } from "@/lib/air/scales";
import { pick, type Colors } from "@/lib/colors/pick";
import { SPC_PALETTES } from "@/lib/colors/spc";
import { briefText, timeIn, type Brief } from "./compose";

/**
 * The Daily Brief email: the brief page as an email. Tables and inline styles only (no SVG,
 * no web fonts, no CSS animation) so Gmail, Outlook and Apple Mail draw it the same; the
 * primary color is text and outline, never a fill. `emailText` is the plain-text twin.
 */
export type National = {
  score: { total: number; label: string; color: string } | null;
  headlines: { title: string; url: string; source: string }[];
};

const BG = "#0b0c14";
const SURFACE = "#141623";
const LINE = "#262a3d";
const TEXT = "#eceef5";
const MUTED = "#8f92a8";
const GOLD = "#d9b76f";
const RAIN = "#4dabf7";
const WARN = "#f87171";
const SPC_LEVELS = ["TSTM", "MRGL", "SLGT", "ENH", "MDT", "HIGH"];
const SPC_WORDS = [
  "General thunder",
  "Marginal · 1 of 5",
  "Slight · 2 of 5",
  "Enhanced · 3 of 5",
  "Moderate · 4 of 5",
  "High · 5 of 5",
];

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );

/** An emoji for a forecast phrase: it renders in every mail app, unlike SVG icons. */
export function skyEmoji(short: string, isDay = true) {
  const s = short.toLowerCase();
  if (/thunder|t-storm|tstorm/.test(s)) return "⛈️";
  if (/snow|flurr|sleet|ice|freezing/.test(s)) return "🌨️";
  if (/rain|shower|drizzle/.test(s)) return "🌧️";
  if (/fog|haze|smoke/.test(s)) return "🌫️";
  if (/wind|breez|blust/.test(s)) return "💨";
  if (/mostly sunny|mostly clear/.test(s)) return isDay ? "🌤️" : "🌙";
  if (/partly|few clouds/.test(s)) return isDay ? "⛅" : "☁️";
  if (/cloud|overcast/.test(s)) return "☁️";
  if (/sunny|clear|fair/.test(s)) return isDay ? "☀️" : "🌙";
  return isDay ? "🌤️" : "🌙";
}

const card = (inner: string, border = LINE) =>
  `<tr><td style="padding:0 0 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${border};border-radius:18px;background:${SURFACE}"><tr><td style="padding:18px">${inner}</td></tr></table></td></tr>`;
const h3 = (t: string) =>
  `<p style="margin:0 0 10px;color:${GOLD};font-size:11px;font-weight:bold;letter-spacing:.18em;text-transform:uppercase">${t}</p>`;

export function emailHtml(
  b: Brief,
  o: { site: string; unsub: string; national: National; colors: Colors },
) {
  const t = briefText(b);
  const x = b.extra;
  const long = new Date(`${b.date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const rows: string[] = [];

  if (b.alerts.length)
    rows.push(
      card(
        `${h3(`<span style="color:${WARN}">⚠ Active alerts</span>`)}${b.alerts
          .map(
            (a) =>
              `<p style="margin:0 0 6px;font-size:15px;line-height:1.4"><b style="color:${TEXT}">${esc(a.event)}</b>${a.ends ? `<span style="color:${MUTED}"> until ${esc(timeIn(a.ends, b.timeZone))}</span>` : ""}</p>`,
          )
          .join(
            "",
          )}<p style="margin:10px 0 0"><a href="${o.site}/warnings-reports" style="color:${WARN};font-weight:bold">See the warnings</a></p>`,
        WARN,
      ),
    );

  if (b.today)
    rows.push(
      card(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="72" valign="top" style="font-size:52px;line-height:1">${skyEmoji(b.today.short)}</td>
<td valign="top"><p style="margin:0;color:${MUTED};font-size:12px;letter-spacing:.14em;text-transform:uppercase">${esc(b.today.name)}</p>
<p style="margin:4px 0 6px;font-family:Georgia,serif;font-size:26px;line-height:1.15;color:${TEXT}">${esc(b.today.short)}</p>
<p style="margin:0;font-size:18px;color:${TEXT}"><span style="color:#fca5a5">↑ ${b.today.high ?? "–"}°</span>&nbsp;&nbsp;<span style="color:#93c5fd">↓ ${b.today.low ?? "–"}°</span></p></td></tr></table>
<p style="margin:14px 0 0;color:${TEXT};font-size:15px;line-height:1.55">${esc(b.today.detail)}</p>`,
      ),
    );

  if (x?.parts.length)
    rows.push(
      card(
        `${h3("Your day")}<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${x.parts
          .map(
            (p) =>
              `<td align="center" valign="top" width="${Math.floor(100 / x.parts.length)}%" style="padding:4px"><p style="margin:0;color:${MUTED};font-size:11px;letter-spacing:.1em;text-transform:uppercase">${p.name}</p><p style="margin:6px 0;font-size:28px;line-height:1">${skyEmoji(p.short, p.isDay)}</p><p style="margin:0;color:${TEXT};font-size:16px;font-weight:bold">${p.hi}°<span style="color:${MUTED};font-weight:normal;font-size:13px"> / ${p.lo}°</span></p><p style="margin:4px 0 0;color:${MUTED};font-size:12px;line-height:1.3">${esc(p.short)}</p><p style="margin:4px 0 0;color:${RAIN};font-size:12px">💧 ${p.pop}%</p></td>`,
          )
          .join("")}</tr></table>`,
      ),
    );

  if (x?.pops.length) {
    const lead = b.rain.startsAt
      ? `Rain likely from about ${timeIn(b.rain.startsAt, b.timeZone)}, up to ${b.rain.peakPop}%.`
      : b.rain.peakPop
        ? `Mostly dry. Chances stay low (up to ${b.rain.peakPop}%).`
        : "Dry. No rain expected.";
    rows.push(
      card(
        `${h3("Rain, next 24 hours")}<p style="margin:0 0 12px;color:${TEXT};font-size:15px">${lead}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="height:64px"><tr>${x.pops
          .map(
            (v) =>
              `<td valign="bottom" style="padding:0 1px"><div style="height:${Math.max(2, Math.round((v / 100) * 60))}px;background:${v >= 40 ? RAIN : LINE};border-radius:3px 3px 0 0;font-size:0;line-height:0">&nbsp;</div></td>`,
          )
          .join("")}</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="color:${MUTED};font-size:11px;padding-top:4px">Now</td><td align="center" style="color:${MUTED};font-size:11px;padding-top:4px">${x.mid ? esc(timeIn(x.mid, b.timeZone)) : "+12 h"}</td><td align="right" style="color:${MUTED};font-size:11px;padding-top:4px">${x.end ? esc(timeIn(x.end, b.timeZone)) : "+24 h"}</td></tr></table>`,
      ),
    );
  }

  const lvl = b.spc ? SPC_LEVELS.indexOf(b.spc) : -1;
  const spcColor = (i: number) =>
    pick(o.colors, `spc:cat:${i}`, SPC_PALETTES.cat[i].color);
  const band = b.aqi != null ? aqiBand(b.aqi) : null;
  rows.push(
    `<tr><td style="padding:0 0 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="50%" valign="top" style="padding-right:7px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:18px;background:${SURFACE}"><tr><td style="padding:16px">${h3("Severe risk")}
<p style="margin:0 0 8px;color:${lvl >= 0 ? spcColor(lvl) : TEXT};font-size:20px;font-weight:bold">${lvl >= 0 ? SPC_WORDS[lvl] : "None today"}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${SPC_LEVELS.map(
      (_, i) =>
        `<td style="padding:0 1px"><div style="height:8px;border-radius:4px;background:${i <= lvl ? spcColor(i) : LINE};font-size:0;line-height:0">&nbsp;</div></td>`,
    ).join("")}</tr></table>
<p style="margin:8px 0 0;color:${MUTED};font-size:12px">From SPC's Day 1 outlook for your place.</p></td></tr></table></td>
<td width="50%" valign="top" style="padding-left:7px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:18px;background:${SURFACE}"><tr><td style="padding:16px">${h3("Air quality")}
${band ? `<p style="margin:0;color:${band.color};font-size:30px;font-weight:bold;line-height:1">${b.aqi}</p><p style="margin:6px 0 0;color:${TEXT};font-size:14px">${esc(band.label)}</p><p style="margin:4px 0 0;color:${MUTED};font-size:12px;line-height:1.4">${esc(band.advice)}</p>` : `<p style="margin:0;color:${MUTED};font-size:14px">No reading here today.</p>`}</td></tr></table></td>
</tr></table></td></tr>`,
  );

  if (x)
    rows.push(
      card(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${(
          [
            ["🌅", x.sunrise ? timeIn(x.sunrise, b.timeZone) : "–", "Sunrise"],
            ["🌇", x.sunset ? timeIn(x.sunset, b.timeZone) : "–", "Sunset"],
            ["💨", `${x.gust} mph`, "Top wind"],
            ["🌙", `${x.moon.pct}%`, x.moon.name],
          ] as const
        )
          .map(
            ([i, v, k]) =>
              `<td align="center" width="25%" style="padding:2px"><p style="margin:0;font-size:20px">${i}</p><p style="margin:4px 0 0;color:${TEXT};font-size:14px;font-weight:bold">${esc(v)}</p><p style="margin:2px 0 0;color:${MUTED};font-size:11px">${esc(k)}</p></td>`,
          )
          .join("")}</tr></table>`,
      ),
    );

  if (b.tomorrow) {
    const diff =
      b.today?.high != null && b.tomorrow.high != null
        ? b.tomorrow.high - b.today.high
        : null;
    rows.push(
      card(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="56" style="font-size:36px;line-height:1">${skyEmoji(b.tomorrow.short)}</td><td>${h3("Tomorrow")}<p style="margin:0;color:${TEXT};font-size:16px">${esc(b.tomorrow.short)}</p><p style="margin:4px 0 0;color:${TEXT};font-size:15px"><b>${b.tomorrow.high ?? "–"}°</b> / ${b.tomorrow.low ?? "–"}°${diff ? `<span style="color:${diff > 0 ? "#fca5a5" : "#93c5fd"}">&nbsp;&nbsp;${Math.abs(diff)}° ${diff > 0 ? "warmer" : "cooler"}</span>` : ""}</p></td></tr></table>`,
      ),
    );
  }

  const n = o.national;
  if (n.score || n.headlines.length)
    rows.push(
      card(
        `${h3("Around the country")}${
          n.score
            ? `<p style="margin:0 0 12px;color:${TEXT};font-size:15px">SSWXCon national score: <b style="color:${n.score.color}">${Math.round(n.score.total)} · ${esc(n.score.label)}</b> <a href="${o.site}/sswxcon" style="color:${GOLD}">details</a></p>`
            : ""
        }${n.headlines
          .map(
            (h) =>
              `<p style="margin:0 0 10px;font-size:14px;line-height:1.4"><a href="${esc(h.url)}" style="color:${TEXT};text-decoration:none"><b>${esc(h.title)}</b></a><br><span style="color:${MUTED};font-size:12px">${esc(h.source)}</span></p>`,
          )
          .join("")}`,
      ),
    );

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>${esc(t.subject)}</title></head>
<body style="margin:0;padding:0;background:${BG};color:${TEXT};font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(t.push)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG}"><tr><td align="center" style="padding:20px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:4px 4px 18px"><p style="margin:0;color:${GOLD};font-size:12px;font-weight:bold;letter-spacing:.22em;text-transform:uppercase">StormSync Daily Brief</p>
<h1 style="margin:6px 0 2px;font-family:Georgia,serif;font-size:30px;font-weight:normal;color:${TEXT}">${esc(b.place)}</h1>
<p style="margin:0;color:${MUTED};font-size:14px">${long}</p></td></tr>
${rows.join("\n")}
<tr><td align="center" style="padding:6px 0 18px"><a href="${o.site}/daily-brief" style="display:inline-block;padding:13px 26px;border:1.5px solid ${GOLD};border-radius:14px;color:${GOLD};font-weight:bold;font-size:15px;text-decoration:none">Open your full brief</a></td></tr>
<tr><td style="padding:0 4px;color:${MUTED};font-size:12px;line-height:1.6;text-align:center"><a href="${o.site}/daily-brief#settings" style="color:${MUTED}">Change these emails</a> · <a href="${o.unsub}" style="color:${MUTED}">Unsubscribe</a><br>You get this because you turned on the Daily Brief at weather.sswx.space.<br>StormSync Weather · weather.sswx.space</td></tr>
</table></td></tr></table></body></html>`;
}

/** The plain-text part: the same brief, for mail apps that don't show HTML. */
export function emailText(
  b: Brief,
  o: { site: string; unsub: string; national: National },
) {
  const t = briefText(b);
  const x = b.extra;
  return [
    `StormSync Daily Brief: ${b.place}`,
    "",
    ...t.lines,
    ...(x?.parts.length
      ? [
          "",
          "Your day:",
          ...x.parts.map(
            (p) => `  ${p.name}: ${p.short}, ${p.hi}°/${p.lo}°, rain ${p.pop}%`,
          ),
        ]
      : []),
    ...(x
      ? [
          "",
          `Sunrise ${x.sunrise ? timeIn(x.sunrise, b.timeZone) : "–"} · Sunset ${x.sunset ? timeIn(x.sunset, b.timeZone) : "–"} · Top wind ${x.gust} mph · Moon ${x.moon.name}`,
        ]
      : []),
    ...(o.national.score
      ? [
          "",
          `SSWXCon national score: ${Math.round(o.national.score.total)} (${o.national.score.label})`,
        ]
      : []),
    ...(o.national.headlines.length
      ? [
          "",
          "Around the country:",
          ...o.national.headlines.map(
            (h) => `  ${h.title} (${h.source}) ${h.url}`,
          ),
        ]
      : []),
    "",
    `Open your full brief: ${o.site}/daily-brief`,
    `Unsubscribe: ${o.unsub}`,
  ].join("\n");
}
