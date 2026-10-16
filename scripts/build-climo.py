#!/usr/bin/env python3
"""
Builds src/lib/climo/{tornado,hurricane}.json from public-domain NOAA records:
  - SPC's tornado database (1950 to the last finished year)
  - NHC's HURDAT2 best tracks, Atlantic and Eastern/Central Pacific (1950 on)

Run when NOAA publishes a new year:  python3 scripts/build-climo.py
"""
import csv, io, json, math, re, urllib.request
from collections import defaultdict
from datetime import date

OUT = "src/lib/climo"
UA = {"User-Agent": "StormSync Weather (https://weather.sswx.space)"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return r.read().decode("latin-1")


def latest(index, pattern):
    names = re.findall(pattern, get(index))
    return sorted(set(names))[-1]


REGIONS = {
    "Great Plains": "ND SD NE KS OK TX CO WY MT NM",
    "Midwest": "MN IA MO WI IL IN MI OH",
    "South": "AR LA MS AL TN KY",
    "Southeast": "GA FL SC NC VA WV",
    "Northeast": "PA NY NJ DE MD CT RI MA VT NH ME DC",
    "West": "",
}
LEN_EDGES = [0, 1, 2, 5, 10, 25, 50, 100]  # miles; last bin is 100+
WID_EDGES = [0, 50, 100, 200, 400, 800, 1600]  # yards; last bin is 1600+


def region(st):
    for k, v in REGIONS.items():
        if st in v.split():
            return k
    return "West"


# ── Tornadoes ──────────────────────────────────────────────────────────────
def tornadoes():
    url = None
    for y in range(date.today().year, 2020, -1):
        try:
            text = get(f"https://www.spc.noaa.gov/wcm/data/1950-{y}_actual_tornadoes.csv")
            url = y
            break
        except Exception:
            continue
    rows = list(csv.DictReader(io.StringIO(text)))
    first, last = 1950, url
    years = list(range(first, last + 1))
    by_year = {y: [0, 0] for y in years}
    months, months_sig, hours = [0] * 12, [0] * 12, [0] * 24
    ef = [0] * 7  # unknown, EF0..EF5
    states = defaultdict(lambda: [0, 0, 0])
    # 0.5° grid over the Lower 48 for the national density map
    lat0, lon0, step, w, h = 24.0, -125.0, 0.5, 118, 52
    grid_all, grid_sig = [0] * (w * h), [0] * (w * h)
    pts = []
    deaths = {y: 0 for y in years}
    deadliest = []
    region_month = {k: [0] * 12 for k in REGIONS}
    len_bins, wid_bins = [0] * len(LEN_EDGES), [0] * len(WID_EDGES)
    for r in rows:
        sg, ns = int(r["sg"]), int(r["ns"])
        mag = int(r["mag"])
        # State tallies: whole single-state tracks plus each state's segment.
        if (sg == 1 and ns == 1) or sg == 2:
            s = states[r["st"]]
            s[0] += 1
            s[1] += 1 if mag >= 2 else 0
            s[2] += int(r["fat"]) if sg == 1 else 0
        if sg != 1:
            continue  # one record per tornado from here on
        y, m = int(r["yr"]), int(r["mo"])
        by_year[y][0] += 1
        by_year[y][1] += 1 if mag >= 2 else 0
        months[m - 1] += 1
        months_sig[m - 1] += 1 if mag >= 2 else 0
        hours[int(r["time"][:2]) % 24] += 1  # CST
        deaths[y] += int(r["fat"])
        if int(r["fat"]) >= 20:
            deadliest.append([r["date"], r["st"], int(r["fat"]), mag])
        region_month[region(r["st"])][m - 1] += 1
        ln, wd = float(r["len"]), float(r["wid"])
        if ln > 0:
            len_bins[sum(1 for e in LEN_EDGES[1:] if ln >= e)] += 1
        if wd > 0:
            wid_bins[sum(1 for e in WID_EDGES[1:] if wd >= e)] += 1
        ef[0 if mag < 0 else mag + 1] += 1
        lat, lon = float(r["slat"]), float(r["slon"])
        if lat <= 0 or lon >= 0:
            continue
        i, j = int((lat - lat0) / step), int((lon - lon0) / step)
        if 0 <= i < h and 0 <= j < w:
            grid_all[i * w + j] += 1
            grid_sig[i * w + j] += 1 if mag >= 2 else 0
        elat, elon = float(r["elat"]), float(r["elon"])
        if elat <= 0 or elon >= 0:
            elat, elon = lat, lon
        pts.append(
            f"{round(lat * 100)},{round(lon * 100)},{round(elat * 100)},{round(elon * 100)},"
            f"{mag},{r['date'].replace('-', '')},{int(r['fat'])},{int(r['inj'])},{r['st']}"
        )
    return {
        "first": first,
        "last": last,
        "byYear": [by_year[y] for y in years],
        "months": months,
        "monthsSig": months_sig,
        "hours": hours,
        "ef": ef,
        "deaths": [deaths[y] for y in years],
        "deadliest": sorted(deadliest, key=lambda d: -d[2])[:12],
        "regionMonth": region_month,
        "lenBins": len_bins,
        "widBins": wid_bins,
        "states": {k: v for k, v in sorted(states.items())},
        "grid": {"lat0": lat0, "lon0": lon0, "step": step, "w": w, "h": h, "all": grid_all, "sig": grid_sig},
        "pts": ";".join(pts),
    }


# ── Hurricanes ─────────────────────────────────────────────────────────────
def category(kt):
    return 0 if kt < 34 else 1 if kt < 64 else 2 if kt < 83 else 3 if kt < 96 else 4 if kt < 113 else 5 if kt < 137 else 6


def hurdat(text, basin):
    storms, cur = [], None
    for line in text.splitlines():
        f = [x.strip() for x in line.split(",")]
        if len(f) >= 3 and re.match(r"^[A-Z]{2}\d{6}$", f[0]):
            cur = {"id": f[0], "name": f[1].title(), "year": int(f[0][4:]), "basin": basin, "pts": []}
            storms.append(cur)
        elif cur and len(f) > 7:
            lat = float(f[4][:-1]) * (1 if f[4][-1] == "N" else -1)
            lon = float(f[5][:-1]) * (-1 if f[5][-1] == "W" else 1)
            kt = int(f[6])
            cur["pts"].append((f[0], f[1], f[2], f[3], lat, lon, kt))
    return [s for s in storms if s["year"] >= 1950]


def hurricanes():
    idx = "https://www.nhc.noaa.gov/data/hurdat/"
    atl = hurdat(get(idx + latest(idx, r"hurdat2-1851-[0-9-]+\.txt")), "AL")
    pac = hurdat(get(idx + latest(idx, r"hurdat2-nepac-[0-9-]+\.txt")), "EP")
    lat0, lon0, step, w, h = 5.0, -140.0, 1.0, 86, 46
    grid_hu, grid_ts = [0] * (w * h), [0] * (w * h)
    season = {"AL": [0] * 366, "EP": [0] * 366}
    ace = {"AL": defaultdict(lambda: [0.0, 0, 0, 0]), "EP": defaultdict(lambda: [0.0, 0, 0, 0])}
    tracks = []
    for s in atl + pac:
        seen_hu, seen_ts, days = set(), set(), set()
        peak = 0
        for d, t, rec, st, lat, lon, kt in s["pts"]:
            peak = max(peak, kt)
            tropical = st in ("TS", "HU", "SS")
            if tropical and t in ("0000", "0600", "1200", "1800") and kt >= 35:
                ace[s["basin"]][s["year"]][0] += kt * kt / 1e4
            if tropical:
                doy = date(int(d[:4]), int(d[4:6]), int(d[6:])).timetuple().tm_yday - 1
                days.add(doy)
            i, j = int((lat - lat0) / step), int((lon - lon0) / step)
            if 0 <= i < h and 0 <= j < w:
                if st == "HU":
                    seen_hu.add(i * w + j)
                if tropical and kt >= 34:
                    seen_ts.add(i * w + j)
        for k in seen_hu:
            grid_hu[k] += 1
        for k in seen_ts:
            grid_ts[k] += 1
        for doy in days:
            season[s["basin"]][doy] += 1
        a = ace[s["basin"]][s["year"]]
        if peak >= 34:
            a[1] += 1
        if peak >= 64:
            a[2] += 1
        if peak >= 96:
            a[3] += 1
        pts = "".join(
            f"{round(lat * 10)},{round(lon * 10)},{kt},{1 if rec == 'L' else 0},{d[4:]}{t[:2]};"
            for d, t, rec, st, lat, lon, kt in s["pts"]
            if st in ("TS", "HU", "SS", "TD", "SD")
        )
        if peak >= 34 and pts:
            tracks.append(f"{s['basin']}|{s['name']}|{s['year']}|{pts.rstrip(';')}")
    return {
        "first": 1950,
        "last": max(s["year"] for s in atl),
        "grid": {"lat0": lat0, "lon0": lon0, "step": step, "w": w, "h": h, "hu": grid_hu, "ts": grid_ts},
        "season": season,
        "ace": {b: [[y, round(v[0], 1), v[1], v[2], v[3]] for y, v in sorted(ace[b].items())] for b in ace},
        "tracks": "\n".join(tracks),
    }


if __name__ == "__main__":
    for name, fn in (("tornado", tornadoes), ("hurricane", hurricanes)):
        data = fn()
        with open(f"{OUT}/{name}.json", "w") as f:
            json.dump(data, f, separators=(",", ":"))
        print(name, "written")
