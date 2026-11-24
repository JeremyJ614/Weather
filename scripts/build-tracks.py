"""
Builds the hurricane history globe's data (Tropical Outlook -> History tab) from NOAA NCEI's
IBTrACS v04r01 (every tropical cyclone on record worldwide, 1842 to last week) and Natural
Earth's 1:50m land (world-atlas topojson). Run it whenever a season ends:

    curl -o /tmp/ib.csv https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.ALL.list.v04r01.csv
    curl -o /tmp/land.json https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-50m.json
    curl -o /tmp/relief.jpg "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=BlueMarble_ShadedRelief&STYLES=&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=4096&HEIGHT=2048&FORMAT=image/jpeg"
    python3 scripts/build-tracks.py /tmp/ib.csv /tmp/land.json /tmp/relief.jpg

The daily data job (.github/workflows/data.yml) runs it with `--out DIR --btk` and no relief,
so a storm NOAA logs reaches the globe the next morning without a deploy: `--btk` also reads
NHC's working best tracks (ftp.nhc.noaa.gov/atcf/btk) and adds any Atlantic, East or Central
Pacific storm IBTrACS hasn't caught up with yet (or runs further than IBTrACS's copy).

Writes public/extras/tracks/{storms.json,points.bin.gz,radii.bin.gz,land.bin.gz} (gzipped here,
since a CDN won't compress binary files; the browser unpacks them with DecompressionStream):
  storms.json  one entry per storm (columns): name, season, basin, start and end (epoch
               hours), first point and point count, peak wind (kt), lowest pressure (hPa),
               ACE (x10), landfalls, track length (km)
  points.bin   every fix (3-hourly and the landfall records between): Int16 lat x100, Int16 lon x100, Uint16 hours since the
               storm began (each a step from the point before within its storm), Uint8 wind
               kt (255 = unknown); each as its own block
  radii.bin    the wind field at every fix, five Uint8 blocks of n: the 34 kt (tropical-storm
               force) radius to the NE, SE, SW and NW, then the largest 64 kt (hurricane force)
               radius, each in 5 nautical mile steps, 0 where no agency measured it (agencies
               measure them since about 2004; the globe estimates the rest from strength)
  land.bin     Uint32 ring count, Uint32 ring lengths, then Int16 lon x100 / lat x100 pairs
  relief.webp  NASA Blue Marble shaded relief (public domain) as grayscale, contrast-stretched
               over land, which shades the land in the globe's own colors (needs Pillow)
Spur tracks (splits and merges IBTrACS keeps beside the main track) are left out.
"""

import csv
import gzip
import json
import math
import os
import struct
import sys
import urllib.request
from datetime import datetime, timezone

BASINS = ["NA", "EP", "WP", "NI", "SI", "SP", "SA"]
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "extras", "tracks")


def num(v):
    try:
        return float(v)
    except ValueError:
        return None


def km(a, b, c, d):
    r = math.pi / 180
    x = math.sin((c - a) * r / 2) ** 2 + math.cos(a * r) * math.cos(c * r) * math.sin((d - b) * r / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(min(1, x)))


def tracks(path):
    storms = {}
    order = []
    with open(path, newline="") as f:
        r = csv.reader(f)
        head = next(r)
        next(r)
        ix = {k: i for i, k in enumerate(head)}
        for row in r:
            if row[ix["TRACK_TYPE"]].startswith("spur"):
                continue
            t = row[ix["ISO_TIME"]]
            sid = row[ix["SID"]]
            if sid not in storms:
                storms[sid] = {"pts": [], "row": row}
                order.append(sid)
            lat, lon = num(row[ix["LAT"]]), num(row[ix["LON"]])
            if lat is None or lon is None:
                continue
            lon = ((lon + 180) % 360) - 180
            w = num(row[ix["USA_WIND"]]) or num(row[ix["WMO_WIND"]])
            p = num(row[ix["USA_PRES"]]) or num(row[ix["WMO_PRES"]])
            when = datetime.strptime(t, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
            land = num(row[ix["DIST2LAND"]])
            radii = wind_field(row, ix)
            # Every fix IBTrACS has (3-hourly, plus landfall and peak records at odd times), so a
            # fast storm's line passes through where it really made landfall.
            hours = when.timestamp() / 3600
            if storms[sid]["pts"] and hours <= storms[sid]["pts"][-1][4]:
                continue
            synoptic = when.hour % 6 == 0 and when.minute == 0
            storms[sid]["pts"].append((lat, lon, w, p, hours, land, synoptic, radii))
    return [(sid, storms[sid]) for sid in order], ix


# Agencies that measure the wind field, first choice first: the 34 kt radius by quadrant
# (NE, SE, SW, NW) and the 64 kt radius, in nautical miles.
R34 = [
    ["USA_R34_NE", "USA_R34_SE", "USA_R34_SW", "USA_R34_NW"],
    ["REUNION_R34_NE", "REUNION_R34_SE", "REUNION_R34_SW", "REUNION_R34_NW"],
    ["BOM_R34_NE", "BOM_R34_SE", "BOM_R34_SW", "BOM_R34_NW"],
]
R64 = [
    ["USA_R64_NE", "USA_R64_SE", "USA_R64_SW", "USA_R64_NW"],
    ["REUNION_R64_NE", "REUNION_R64_SE", "REUNION_R64_SW", "REUNION_R64_NW"],
    ["BOM_R64_NE", "BOM_R64_SE", "BOM_R64_SW", "BOM_R64_NW"],
]


def wind_field(row, ix):
    """(NE, SE, SW, NW 34 kt radii, largest 64 kt radius) in nm, zeros where none was measured."""
    q = [0, 0, 0, 0]
    for cols in R34:
        v = [num(row[ix[c]]) or 0 for c in cols]
        if any(v):
            q = v
            break
    else:
        # Japan and Korea give a 30 kt circle (longest radius): near enough to 34 kt.
        for c in ("TOKYO_R30_LONG", "KMA_R30_LONG"):
            v = num(row[ix[c]]) if c in ix else None
            if v:
                q = [v] * 4
                break
    r64 = 0
    for cols in R64:
        v = [num(row[ix[c]]) or 0 for c in cols]
        if any(v):
            r64 = max(v)
            break
    return (*q, r64)


def pack_nm(v):
    return max(0, min(255, round((v or 0) / 5)))


def btk_storms(season, land):
    """
    NHC's working best tracks for a season (Atlantic, East and Central Pacific): one entry per
    storm number under 50 (90s are invests), from the first tropical or subtropical fix on.
    """
    base = "https://ftp.nhc.noaa.gov/atcf/btk/"
    try:
        listing = urllib.request.urlopen(base, timeout=30).read().decode()
    except OSError as e:
        print(f"btk listing failed: {e}")
        return []
    out = []
    names = sorted(set(re_findall(r"b(al|ep|cp)(\d\d)" + str(season) + r"\.dat", listing)))
    for b, num_ in names:
        if int(num_) >= 50:
            continue
        try:
            text = urllib.request.urlopen(f"{base}b{b}{num_}{season}.dat", timeout=30).read().decode()
        except OSError:
            continue
        fixes = {}
        name = ""
        for line in text.splitlines():
            c = [x.strip() for x in line.split(",")]
            if len(c) < 11 or c[4] != "BEST":
                continue
            when = datetime.strptime(c[2], "%Y%m%d%H").replace(tzinfo=timezone.utc)
            lat = int(c[6][:-1]) / 10 * (1 if c[6][-1] == "N" else -1)
            lon = int(c[7][:-1]) / 10 * (1 if c[7][-1] == "E" else -1)
            f = fixes.setdefault(
                c[2],
                {
                    "h": when.timestamp() / 3600,
                    "lat": lat,
                    "lon": ((lon + 180) % 360) - 180,
                    "w": num(c[8]),
                    "p": num(c[9]),
                    "ty": c[10],
                    "r34": [0, 0, 0, 0],
                    "r64": 0,
                },
            )
            if len(c) > 16 and c[11] in ("34", "64") and c[12] == "NEQ":
                r = [num(x) or 0 for x in c[13:17]]
                if c[11] == "34":
                    f["r34"] = r
                else:
                    f["r64"] = max(r)
            if len(c) > 27 and c[27] and c[27] not in ("INVEST",) and not c[27].startswith("GENESIS"):
                name = c[27]
        pts = sorted(fixes.values(), key=lambda f: f["h"])
        tc = ("TD", "TS", "HU", "TY", "ST", "TC", "SD", "SS")
        first = next((i for i, f in enumerate(pts) if f["ty"] in tc), None)
        if first is None:
            continue
        pts = pts[first:]
        if len(pts) < 2:
            continue
        out.append(
            {
                "atcf": f"{b.upper()}{num_}{season}",
                "basin": "NA" if b == "al" else "EP",
                "name": "" if name in ("", "NONAME", "UNNAMED") else name.title(),
                "pts": [
                    (
                        f["lat"],
                        f["lon"],
                        f["w"],
                        f["p"],
                        f["h"],
                        0 if over_land(land, f["lat"], f["lon"]) else 1,
                        True,
                        (*f["r34"], f["r64"]),
                    )
                    for f in pts
                ],
            }
        )
    return out


def re_findall(pat, text):
    import re

    return re.findall(pat, text)


def over_land(rings, lat, lon):
    """Point in polygon against the land rings (even-odd), with a bounding-box pass first."""
    inside = False
    for r, (x0, y0, x1, y1) in rings:
        if lon < x0 or lon > x1 or lat < y0 or lat > y1:
            continue
        j = len(r) - 1
        for i in range(len(r)):
            xi, yi = r[i]
            xj, yj = r[j]
            if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
                inside = not inside
            j = i
    return inside


def land_rings(path):
    topo = json.load(open(path))
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)
    rings = []
    for geo in topo["objects"]["land"]["geometries"]:
        polys = geo["arcs"] if geo["type"] == "MultiPolygon" else [geo["arcs"]]
        for poly in polys:
            for ring in poly:
                pts = []
                for a in ring:
                    seg = arcs[a] if a >= 0 else list(reversed(arcs[~a]))
                    pts.extend(seg if not pts else seg[1:])
                if len(pts) >= 4:
                    xs = [p[0] for p in pts]
                    ys = [p[1] for p in pts]
                    rings.append((pts, (min(xs), min(ys), max(xs), max(ys))))
    return rings


def relief(path, out=OUT):
    """NASA's Blue Marble shaded relief as one grayscale layer, land stretched to full contrast."""
    from PIL import Image, ImageOps

    im = Image.open(path).convert("L")
    if im.size != (4096, 2048):
        im = im.resize((4096, 2048), Image.LANCZOS)
    # Land shading spans the middle of the range; the near-black ocean is masked at runtime.
    im = ImageOps.autocontrast(im, cutoff=(2, 1))
    # Ice sheets would glare white over Greenland and Antarctica: cap the brightest.
    im = im.point(lambda v: min(v, 185))
    im.save(os.path.join(out, "relief.webp"), "WEBP", quality=72, method=6)


def merge_btk(entries, rings):
    """Adds NHC's newest storms, or a longer copy of one, to IBTrACS's list (this season and last)."""
    year = datetime.now(timezone.utc).year
    by_atcf = {e["atcf"]: e for e in entries if e["atcf"]}
    added = longer = 0
    for season in (year - 1, year):
        for b in btk_storms(season, rings):
            have = by_atcf.get(b["atcf"])
            if have is None:
                entries.append({"name": b["name"], "season": season, "basin": b["basin"], "atcf": b["atcf"], "pts": b["pts"]})
                added += 1
            elif b["pts"][-1][4] > have["pts"][-1][4] + 6:
                # IBTrACS hasn't caught up: keep its fixes and add NHC's after them.
                last = have["pts"][-1][4]
                have["pts"] = have["pts"] + [p for p in b["pts"] if p[4] > last]
                have["name"] = have["name"] or b["name"]
                longer += 1
    entries.sort(key=lambda e: e["pts"][0][4] if e["pts"] else 0)
    print(f"NHC best tracks: {added} storms added, {longer} extended")


def main(csv_path, land_path, relief_path=None, out=OUT, btk=False):
    os.makedirs(out, exist_ok=True)
    rows, ix = tracks(csv_path)
    entries = []
    for sid, s in rows:
        row = s["row"]
        name = row[ix["NAME"]].strip()
        basin = row[ix["BASIN"]] if row[ix["BASIN"]] in BASINS else ("NA" if row[ix["BASIN"]] == "MM" else "WP")
        entries.append(
            {
                "name": "" if name in ("NOT_NAMED", "UNNAMED", "") else name.title(),
                "season": int(row[ix["SEASON"]]),
                "basin": basin,
                "atcf": row[ix["USA_ATCF_ID"]].strip(),
                "pts": s["pts"],
            }
        )
    rings = land_rings(land_path)
    if btk:
        merge_btk(entries, rings)
    cols = {k: [] for k in ["name", "y", "b", "t0", "t1", "o", "n", "w", "p", "a", "lf", "km"]}
    lat, lon, wind, hrs = [], [], [], []
    radii = [[], [], [], [], []]
    for e in entries:
        pts = e["pts"]
        if len(pts) < 2:
            continue
        name = e["name"]
        winds = [p[2] for p in pts if p[2] is not None]
        pres = [p[3] for p in pts if p[3] is not None and p[3] > 850]
        # ACE counts the 6-hourly synoptic fixes only, as its definition says.
        ace = sum(p[2] ** 2 for p in pts if p[6] and p[2] is not None and p[2] >= 35) / 1e4
        falls = sum(1 for a, b in zip(pts, pts[1:]) if (a[5] or 0) > 0 and b[5] == 0)
        dist = sum(km(a[0], a[1], b[0], b[1]) for a, b in zip(pts, pts[1:]))
        cols["name"].append(name)
        cols["y"].append(e["season"])
        cols["b"].append(BASINS.index(e["basin"]))
        cols["t0"].append(math.floor(pts[0][4]))
        cols["t1"].append(math.ceil(pts[-1][4]))
        cols["o"].append(len(lat))
        cols["n"].append(len(pts))
        cols["w"].append(int(max(winds)) if winds else 0)
        cols["p"].append(int(min(pres)) if pres else 0)
        cols["a"].append(round(ace * 10))
        cols["lf"].append(falls)
        cols["km"].append(round(dist))
        for p in pts:
            lat.append(round(p[0] * 100))
            lon.append(round(p[1] * 100))
            wind.append(255 if p[2] is None else min(254, int(p[2])))
            # Hours since the storm began, rounded to the hour for the playback clock.
            hrs.append(min(65535, round(p[4] - pts[0][4])))
            for k in range(5):
                radii[k].append(pack_nm(p[7][k]))
    n = len(lat)
    # Positions and hours as steps from the point before within each storm (the first point
    # absolute): small numbers that gzip packs tightly. The browser adds them back up.
    first = set(cols["o"])
    dlat = [v if i in first else v - lat[i - 1] for i, v in enumerate(lat)]
    dlon = [v if i in first else ((v - lon[i - 1] + 18000) % 36000) - 18000 for i, v in enumerate(lon)]
    dhrs = [v if i in first else v - hrs[i - 1] for i, v in enumerate(hrs)]
    raw = (
        struct.pack(f"<{n}h", *dlat)
        + struct.pack(f"<{n}h", *dlon)
        + struct.pack(f"<{n}H", *dhrs)
        + bytes(wind)
    )
    with open(os.path.join(out, "points.bin.gz"), "wb") as f:
        f.write(gzip.compress(raw, 9, mtime=0))
    with open(os.path.join(out, "radii.bin.gz"), "wb") as f:
        f.write(gzip.compress(b"".join(bytes(r) for r in radii), 9, mtime=0))
    meta = {
        "v": 1,
        "source": "NOAA NCEI IBTrACS v04r01",
        "built": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "points": n,
        "basins": BASINS,
        "s": cols,
    }
    with open(os.path.join(out, "storms.json"), "w") as f:
        json.dump(meta, f, separators=(",", ":"))
    body = struct.pack("<I", len(rings)) + struct.pack(f"<{len(rings)}I", *[len(r) for r, _ in rings])
    for r, _ in rings:
        body += struct.pack(f"<{2 * len(r)}h", *[v for p in r for v in (round(p[0] * 100), round(p[1] * 100))])
    with open(os.path.join(out, "land.bin.gz"), "wb") as f:
        f.write(gzip.compress(body, 9, mtime=0))
    if relief_path:
        relief(relief_path, out)
    print(f"{len(cols['y'])} storms, {n} points, seasons {min(cols['y'])}-{max(cols['y'])}, {len(rings)} land rings")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = sys.argv[1:]
    out = flags[flags.index("--out") + 1] if "--out" in flags else OUT
    if "--out" in flags:
        args.remove(out)
    main(args[0], args[1], args[2] if len(args) > 2 else None, out=out, btk="--btk" in flags)
