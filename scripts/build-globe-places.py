"""
Builds the History Globe's Places layer (Tropical Outlook -> History -> Places): country, state
and province, and city names, and the borders between them, from Natural Earth (public domain).
Run once; borders and names don't change with the seasons:

    NE=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
    for f in ne_50m_admin_0_countries ne_50m_admin_0_boundary_lines_land \
             ne_50m_admin_1_states_provinces ne_50m_admin_1_states_provinces_lines \
             ne_10m_admin_1_label_points ne_10m_admin_1_states_provinces_lines \
             ne_10m_populated_places_simple; do curl -so /tmp/ne/$f.geojson $NE/$f.geojson; done
    python3 scripts/build-globe-places.py /tmp/ne

Writes public/extras/tracks/places.json and borders.bin.gz:
  places.json  {"c": countries, "s": states and provinces, "t": towns}, each a list of
               [name, lat, lon, rank]: rank 1 is shown first and from farthest out
               (countries by Natural Earth's label rank, states by their country's, towns by
               population: 1 over 5 million, 2 over 1 million, 3 over 300,000, 4 the rest)
  borders.bin  Uint32 country line count, Uint32 state line count, Uint32 each line's length,
               then Int16 lon x100 / lat x100 pairs (country lines first)
"""

import gzip
import json
import math
import os
import struct
import sys

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "extras", "tracks")
# Coasts that tropical cyclones reach whose states Natural Earth's 1:50m set leaves out.
EXTRA_STATES = {
    "MEX": "Mexico",
    "JPN": "Japan",
    "PHL": "Philippines",
    "VNM": "Vietnam",
    "CUB": "Cuba",
    "MDG": "Madagascar",
    "MOZ": "Mozambique",
    "BGD": "Bangladesh",
    "KOR": "South Korea",
    "TWN": "Taiwan",
    "MMR": "Myanmar",
    "OMN": "Oman",
    "HND": "Honduras",
    "GTM": "Guatemala",
    "NIC": "Nicaragua",
    "DOM": "Dominican Republic",
    "HTI": "Haiti",
    "NZL": "New Zealand",
}

# Names as a map writes them.
SHORT = {
    "United States of America": "United States",
    "Dem. Rep. Congo": "DR Congo",
    "Central African Rep.": "Central African Republic",
    "Dominican Rep.": "Dominican Republic",
    "Bosnia and Herz.": "Bosnia and Herzegovina",
    "S. Sudan": "South Sudan",
    "Eq. Guinea": "Equatorial Guinea",
    "Solomon Is.": "Solomon Islands",
    "Marshall Is.": "Marshall Islands",
    "N. Mariana Is.": "Northern Mariana Islands",
    "Cayman Is.": "Cayman Islands",
    "Turks and Caicos Is.": "Turks and Caicos",
    "British Virgin Is.": "British Virgin Islands",
    "U.S. Virgin Is.": "U.S. Virgin Islands",
    "Fr. Polynesia": "French Polynesia",
    "W. Sahara": "Western Sahara",
    "Falkland Is.": "Falkland Islands",
    "Cook Is.": "Cook Islands",
    "Faeroe Is.": "Faroe Islands",
    "St. Vin. and Gren.": "St. Vincent",
    "Antigua and Barb.": "Antigua and Barbuda",
    "St. Kitts and Nevis": "St. Kitts and Nevis",
    "Wallis and Futuna Is.": "Wallis and Futuna",
    "Fr. S. Antarctic Lands": "French Southern Lands",
    "Heard I. and McDonald Is.": "Heard Island",
    "S. Geo. and the Is.": "South Georgia",
    "Br. Indian Ocean Ter.": "British Indian Ocean Territory",
}


def load(d, f):
    return json.load(open(os.path.join(d, f + ".geojson")))["features"]


def lines(features, keep=lambda p: True):
    out = []
    for f in features:
        if not keep(f["properties"]):
            continue
        g = f["geometry"]
        if not g:
            continue
        for c in g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]:
            if len(c) >= 2:
                out.append(c)
    return out


def simplify(pts, tol):
    """Douglas-Peucker, in degrees."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a][:2]
        bx, by = pts[b][:2]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy) or 1e-12
        best, at = 0, -1
        for i in range(a + 1, b):
            px, py = pts[i][:2]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / L
            if d > best:
                best, at = d, i
        if best > tol and at > 0:
            keep[at] = True
            stack += [(a, at), (at, b)]
    return [p for p, k in zip(pts, keep) if k]


def rank_town(pop):
    return 1 if pop >= 5e6 else 2 if pop >= 1e6 else 3 if pop >= 3e5 else 4


def main(d, out=OUT):
    countries = []
    for f in load(d, "ne_50m_admin_0_countries"):
        p = f["properties"]
        if p.get("LABEL_X") is None:
            continue
        name = SHORT.get(p["NAME"], p["NAME"])
        countries.append([name, round(p["LABEL_Y"], 2), round(p["LABEL_X"], 2), int(p["LABELRANK"])])
    countries.sort(key=lambda c: c[3])

    states = []
    seen = set()
    for f in load(d, "ne_50m_admin_1_states_provinces"):
        p = f["properties"]
        key = (p["admin"], p["name"])
        if key in seen or p.get("latitude") is None:
            continue
        seen.add(key)
        states.append([p["name"], round(p["latitude"], 2), round(p["longitude"], 2), max(1, int(p["labelrank"] or 5) - 1)])
    for f in load(d, "ne_10m_admin_1_label_points"):
        p = f["properties"]
        if p.get("sr_adm0_a3") not in EXTRA_STATES or not p.get("name"):
            continue
        key = (p["sr_adm0_a3"], p["name"])
        if key in seen:
            continue
        seen.add(key)
        lon, lat = f["geometry"]["coordinates"][:2]
        states.append([p["name"], round(lat, 2), round(lon, 2), 4])
    states.sort(key=lambda s: s[3])

    towns = []
    for f in load(d, "ne_10m_populated_places_simple"):
        p = f["properties"]
        pop = p.get("pop_max") or 0
        if pop < 150_000 and not p.get("adm0cap"):
            continue
        towns.append([p["name"], round(p["latitude"], 2), round(p["longitude"], 2), rank_town(pop), pop])
    towns.sort(key=lambda t: -t[4])
    towns = [t[:4] for t in towns]

    country_lines = [simplify(c, 0.03) for c in lines(load(d, "ne_50m_admin_0_boundary_lines_land"))]
    state_lines = [simplify(c, 0.03) for c in lines(load(d, "ne_50m_admin_1_states_provinces_lines"))]
    state_lines += [
        simplify(c, 0.04)
        for c in lines(load(d, "ne_10m_admin_1_states_provinces_lines"), lambda p: p.get("ADM0_A3") in EXTRA_STATES)
    ]
    body = struct.pack("<II", len(country_lines), len(state_lines))
    every = country_lines + state_lines
    body += struct.pack(f"<{len(every)}I", *[len(c) for c in every])
    for c in every:
        body += struct.pack(f"<{2 * len(c)}h", *[round(v * 100) for p in c for v in p[:2]])
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "borders.bin.gz"), "wb") as f:
        f.write(gzip.compress(body, 9, mtime=0))
    with open(os.path.join(out, "places.json"), "w") as f:
        json.dump({"c": countries, "s": states, "t": towns}, f, separators=(",", ":"), ensure_ascii=False)
    pts = sum(len(c) for c in every)
    print(f"{len(countries)} countries, {len(states)} states, {len(towns)} towns, {len(every)} border lines ({pts} points)")


if __name__ == "__main__":
    main(*sys.argv[1:3])
