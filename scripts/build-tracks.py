"""
Builds the hurricane history globe's data (Tropical Outlook -> History tab) from NOAA NCEI's
IBTrACS v04r01 (every tropical cyclone on record worldwide, 1842 to last week) and Natural
Earth's 1:50m land (world-atlas topojson). Run it whenever a season ends:

    curl -o /tmp/ib.csv https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.ALL.list.v04r01.csv
    curl -o /tmp/land.json https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-50m.json
    python3 scripts/build-tracks.py /tmp/ib.csv /tmp/land.json

Writes public/extras/tracks/{storms.json,points.bin.gz,land.bin.gz} (gzipped here, since a CDN
won't compress binary files; the browser unpacks them with DecompressionStream):
  storms.json  one entry per storm (columns): name, season, basin, start and end (epoch
               hours), first point and point count, peak wind (kt), lowest pressure (hPa),
               ACE (x10), landfalls, track length (km)
  points.bin   every fix (3-hourly and the landfall records between): Int16 lat x100, Int16 lon x100, Uint16 hours since the
               storm began (each a step from the point before within its storm), Uint8 wind
               kt (255 = unknown); each as its own block
  land.bin     Uint32 ring count, Uint32 ring lengths, then Int16 lon x100 / lat x100 pairs
Spur tracks (splits and merges IBTrACS keeps beside the main track) are left out.
"""

import csv
import gzip
import json
import math
import os
import struct
import sys
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
            # Every fix IBTrACS has (3-hourly, plus landfall and peak records at odd times), so a
            # fast storm's line passes through where it really made landfall.
            hours = when.timestamp() / 3600
            if storms[sid]["pts"] and hours <= storms[sid]["pts"][-1][4]:
                continue
            synoptic = when.hour % 6 == 0 and when.minute == 0
            storms[sid]["pts"].append((lat, lon, w, p, hours, land, synoptic))
    return [(sid, storms[sid]) for sid in order], ix


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
                    rings.append(pts)
    return rings


def main(csv_path, land_path):
    os.makedirs(OUT, exist_ok=True)
    rows, ix = tracks(csv_path)
    cols = {k: [] for k in ["name", "y", "b", "t0", "t1", "o", "n", "w", "p", "a", "lf", "km"]}
    lat, lon, wind, hrs = [], [], [], []
    for sid, s in rows:
        pts = s["pts"]
        if len(pts) < 2:
            continue
        row = s["row"]
        name = row[ix["NAME"]].strip()
        name = "" if name in ("NOT_NAMED", "UNNAMED", "") else name.title()
        winds = [p[2] for p in pts if p[2] is not None]
        pres = [p[3] for p in pts if p[3] is not None and p[3] > 850]
        # ACE counts the 6-hourly synoptic fixes only, as its definition says.
        ace = sum(p[2] ** 2 for p in pts if p[6] and p[2] is not None and p[2] >= 35) / 1e4
        falls = sum(1 for a, b in zip(pts, pts[1:]) if (a[5] or 0) > 0 and b[5] == 0)
        dist = sum(km(a[0], a[1], b[0], b[1]) for a, b in zip(pts, pts[1:]))
        cols["name"].append(name)
        cols["y"].append(int(row[ix["SEASON"]]))
        basin = row[ix["BASIN"]] if row[ix["BASIN"]] in BASINS else ("NA" if row[ix["BASIN"]] == "MM" else "WP")
        cols["b"].append(BASINS.index(basin))
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
    with open(os.path.join(OUT, "points.bin.gz"), "wb") as f:
        f.write(gzip.compress(raw, 9, mtime=0))
    meta = {
        "v": 1,
        "source": "NOAA NCEI IBTrACS v04r01",
        "built": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "points": n,
        "basins": BASINS,
        "s": cols,
    }
    with open(os.path.join(OUT, "storms.json"), "w") as f:
        json.dump(meta, f, separators=(",", ":"))
    rings = land_rings(land_path)
    body = struct.pack("<I", len(rings)) + struct.pack(f"<{len(rings)}I", *[len(r) for r in rings])
    for r in rings:
        body += struct.pack(f"<{2 * len(r)}h", *[v for p in r for v in (round(p[0] * 100), round(p[1] * 100))])
    with open(os.path.join(OUT, "land.bin.gz"), "wb") as f:
        f.write(gzip.compress(body, 9, mtime=0))
    print(f"{len(cols['y'])} storms, {n} points, seasons {min(cols['y'])}-{max(cols['y'])}, {len(rings)} land rings")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
