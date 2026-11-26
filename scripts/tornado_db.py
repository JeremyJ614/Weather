#!/usr/bin/env python3
"""
Tornado Database data (owner's Weather list #42, item 2).

Builds src/data/tornado/ from two public sources, with no packages beyond Python itself:
  - NOAA SPC's tornado record, 1950 to the last finished year (one row per tornado, plus one
    row per state for tornadoes that crossed a state line):
    https://www.spc.noaa.gov/wcm/data/1950-2025_all_tornadoes.csv
  - US Census county outlines (cartographic boundary, 1:500k):
    https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_county_500k.zip

Run once a year, after SPC publishes the next finished year:
  python3 scripts/tornado_db.py all_tornadoes.csv cb_2024_us_county_500k.shp

Writes:
  index.json   every county: fips, name, state, count, strongest, latest, centre, neighbours
  st/XX.json   per state: county outlines (simplified) and every track touching the state,
               with the miles of each track inside each county
"""
import csv, json, math, os, re, struct, sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

CSV, SHP = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", "tornado")
os.makedirs(os.path.join(OUT, "st"), exist_ok=True)

ABBR = {"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY","72":"PR","78":"VI","60":"AS","66":"GU","69":"MP"}

# ---- Shapefile (polygon type 5) and dBase reader -------------------------------------------
def read_dbf(path):
    with open(path, "rb") as f:
        head = f.read(32)
        n, hlen, rlen = struct.unpack("<IHH", head[4:12])
        fields = []
        while True:
            d = f.read(32)
            if d[0] == 0x0D: break
            fields.append((d[:11].split(b"\0")[0].decode(), d[16]))
        f.seek(hlen)
        rows = []
        for _ in range(n):
            rec = f.read(rlen)[1:]
            row, o = {}, 0
            for name, ln in fields:
                row[name] = rec[o:o + ln].decode("utf-8", "replace").strip(); o += ln
            rows.append(row)
    return rows

def read_shp(path):
    out = []
    with open(path, "rb") as f:
        f.seek(100)
        while True:
            h = f.read(8)
            if len(h) < 8: break
            _, ln = struct.unpack(">II", h)
            rec = f.read(ln * 2)
            if struct.unpack("<i", rec[:4])[0] != 5: out.append([]); continue
            nparts, npts = struct.unpack("<ii", rec[36:44])
            parts = struct.unpack(f"<{nparts}i", rec[44:44 + 4 * nparts])
            pts = struct.unpack(f"<{2 * npts}d", rec[44 + 4 * nparts:44 + 4 * nparts + 16 * npts])
            rings = []
            for i, s in enumerate(parts):
                e = parts[i + 1] if i + 1 < nparts else npts
                rings.append([(pts[2 * k], pts[2 * k + 1]) for k in range(s, e)])
            out.append(rings)
    return out

def simplify(pts, tol):
    """Douglas-Peucker on lon/lat (tolerance in degrees), keeping ring closure."""
    if len(pts) < 5: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy
        best, bi = -1, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if L == 0: d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L))
                d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d > best: best, bi = d, i
        if best > tol * tol:
            keep[bi] = True; stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]

def inside(rings, x, y):
    hit = False
    for r in rings:
        j = len(r) - 1
        for i in range(len(r)):
            xi, yi = r[i]; xj, yj = r[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: hit = not hit
            j = i
    return hit

def frac_inside(rings, a, b):
    """Share of the straight segment a→b (lon, lat) that lies inside the polygon."""
    (x1, y1), (x2, y2) = a, b
    if (x1, y1) == (x2, y2): return 1.0 if inside(rings, x1, y1) else 0.0
    ts = [0.0, 1.0]
    dx, dy = x2 - x1, y2 - y1
    for r in rings:
        for i in range(len(r) - 1):
            (x3, y3), (x4, y4) = r[i], r[i + 1]
            den = dx * (y4 - y3) - dy * (x4 - x3)
            if den == 0: continue
            t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / den
            u = ((x3 - x1) * dy - (y3 - y1) * dx) / den
            if 0 < t < 1 and 0 <= u <= 1: ts.append(t)
    ts.sort(); f = 0.0
    for t0, t1 in zip(ts, ts[1:]):
        if t1 - t0 < 1e-9: continue
        m = (t0 + t1) / 2
        if inside(rings, x1 + dx * m, y1 + dy * m): f += t1 - t0
    return f

# ---- Local time zones (county level, close enough for a touchdown time) ------------------
EAST = set("CT DE DC FL GA IN KY ME MD MA MI NH NJ NY NC OH PA RI SC TN VT VA WV PR VI".split())
CENT = set("AL AR IL IA LA MN MS MO OK WI TX KS NE ND SD".split())
MOUNT = set("CO MT NM UT WY ID".split())
PAC = set("CA NV OR WA".split())
IN_CENTRAL = {"18089", "18127", "18111", "18073", "18091", "18149", "18051", "18129", "18163", "18173", "18147", "18123"}
MI_CENTRAL = {"26053", "26071", "26043", "26109"}
KS_MOUNTAIN = {"20181", "20199", "20071", "20075"}
TX_MOUNTAIN = {"48141", "48229"}
def zone(st, fips, lon, lat):
    if st == "AZ": return "America/Phoenix"
    if st == "HI": return "Pacific/Honolulu"
    if st == "AK": return "America/Anchorage"
    if st in ("PR", "VI"): return "America/Puerto_Rico"
    if st == "FL" and lon < -85.0: return "America/Chicago"
    if st == "IN" and fips in IN_CENTRAL: return "America/Chicago"
    if st == "KY" and lon < -85.6: return "America/Chicago"
    if st == "TN" and lon < -84.95: return "America/Chicago"
    if st == "MI" and fips in MI_CENTRAL: return "America/Chicago"
    if st == "KS" and fips in KS_MOUNTAIN: return "America/Denver"
    if st == "NE" and lon < -101.2: return "America/Denver"
    if st == "ND" and lon < -101.3 and lat < 47.3: return "America/Denver"
    if st == "SD" and lon < -100.6: return "America/Denver"
    if st == "TX" and fips in TX_MOUNTAIN: return "America/Denver"
    if st == "ID" and lat > 45.6: return "America/Los_Angeles"
    if st == "OR" and fips == "41045": return "America/Denver"
    if st in EAST: return "America/New_York"
    if st in CENT: return "America/Chicago"
    if st in MOUNT: return "America/Denver"
    if st in PAC: return "America/Los_Angeles"
    return "America/Chicago"

def local(date, time, tz, zname):
    try:
        base = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return "", ""
    utc = base - timedelta(hours=0) if tz == "9" else base + timedelta(hours=6)  # CST = UTC−6
    t = utc.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(zname))
    return t.strftime("%Y-%m-%d %H:%M"), t.tzname()

# ---- Counties --------------------------------------------------------------------------------
dbf, shp = read_dbf(SHP[:-4] + ".dbf"), read_shp(SHP)
counties = {}
for row, rings in zip(dbf, shp):
    sf = row["STATEFP"]; st = ABBR.get(sf)
    if not st or not rings: continue
    fips = sf + row["COUNTYFP"]
    xs = [p[0] for r in rings for p in r]; ys = [p[1] for r in rings for p in r]
    # The big ring's average point is a fair label spot; the bounding box frames the map.
    big = max(rings, key=len)
    cx = sum(p[0] for p in big) / len(big); cy = sum(p[1] for p in big) / len(big)
    counties[fips] = dict(st=st, name=row["NAMELSAD"], rings=rings, box=[min(xs), min(ys), max(xs), max(ys)], c=(cx, cy))

# Neighbours: counties that share an outline point (rounded to ~10 m).
owner = defaultdict(set)
for f, c in counties.items():
    for r in c["rings"]:
        for x, y in r[::2]: owner[(round(x, 4), round(y, 4))].add(f)
nb = defaultdict(set)
for fs in owner.values():
    if 1 < len(fs) < 6:
        for a in fs: nb[a] |= fs - {a}

# ---- Tracks ----------------------------------------------------------------------------------
by_state = defaultdict(list)
count = defaultdict(int); top = defaultdict(lambda: -2); last = defaultdict(str)
seen = 0
for r in csv.DictReader(open(CSV)):
    if r["sg"] not in ("1", "2"): continue
    st = r["st"]; sf = r["stf"].zfill(2)
    slat, slon, elat, elon = (float(r[k] or 0) for k in ("slat", "slon", "elat", "elon"))
    if not slat or not slon: continue
    if not elat or not elon: elat, elon = slat, slon
    a, b = (slon, slat), (elon, elat)
    codes = {sf + r[k].zfill(3) for k in ("f1", "f2", "f3", "f4") if r[k] and r[k] != "0" and sf + r[k].zfill(3) in counties}
    if len(codes) in (0, 4):
        # Up to four counties are coded per state; a longer track (or none coded) is placed by its line.
        lo, hi = (min(slon, elon), min(slat, elat)), (max(slon, elon), max(slat, elat))
        for f, c in counties.items():
            if c["st"] != st: continue
            bx = c["box"]
            if bx[2] < lo[0] or bx[0] > hi[0] or bx[3] < lo[1] or bx[1] > hi[1]: continue
            if frac_inside(c["rings"], a, b) > 0: codes.add(f)
    if not codes: continue
    L = float(r["len"] or 0); W = int(float(r["wid"] or 0))
    inc = {}
    for f in codes:
        fr = frac_inside(counties[f]["rings"], a, b)
        inc[f] = round(L * fr, 2) if fr > 0 else (L if len(codes) == 1 else -1)
    f0 = next(iter(codes)); c0 = counties[f0]
    when, zn = local(r["date"], r["time"], r["tz"], zone(st, f0, slon, slat))
    mag = int(r["mag"]) if r["mag"] not in ("", "-9") else -1
    # F-scale before February 2007, EF after.
    ef = r["date"] >= "2007-02-01"
    # [local date time, zone, rating (-1 unknown), EF (1) or F (0), miles, yards, injuries, deaths,
    #  start lat, start lon, end lat, end lon, [county, miles inside (-1 unknown), ...]]
    by_state[st].append([when or r["date"], zn, mag, 1 if ef else 0, L, W, int(r["inj"] or 0), int(r["fat"] or 0),
        round(slat, 4), round(slon, 4), round(elat, 4), round(elon, 4), [v for f in sorted(inc) for v in (f, inc[f])]])
    seen += 1
    for f in codes:
        count[f] += 1
        if mag > top[f]: top[f] = mag
        if r["date"] > last[f]: last[f] = r["date"]

slug = lambda c: re.sub(r"[^a-z0-9]+", "-", (c["name"] + " " + c["st"]).lower()).strip("-")
index = []
for f, c in sorted(counties.items()):
    index.append([f, c["name"], c["st"], count[f], top[f] if count[f] else -2, last[f], round(c["c"][1], 3), round(c["c"][0], 3), sorted(nb[f])])
json.dump({"through": max(last.values())[:4], "counties": index}, open(os.path.join(OUT, "index.json"), "w"), separators=(",", ":"))

flat = lambda ring: [v for x, y in ring for v in (round(x, 3), round(y, 3))]
for st in sorted(set(c["st"] for c in counties.values())):
    shapes = {}
    for f, c in counties.items():
        if c["st"] != st: continue
        rings = [flat(simplify(r, 0.006 if st == "AK" else 0.0012)) for r in c["rings"]]
        # Tiny islands add bytes but nothing a reader would see.
        shapes[f] = dict(n=c["name"], b=[round(v, 3) for v in c["box"]], o=[r for r in rings if len(r) >= 8] or rings[:1])
    tracks = sorted(by_state.get(st, []), key=lambda t: t[0], reverse=True)
    json.dump({"st": st, "counties": shapes, "tracks": tracks}, open(os.path.join(OUT, "st", f"{st}.json"), "w"), separators=(",", ":"))
print("tracks", seen, "counties", len(counties), "through", max(last.values()))
