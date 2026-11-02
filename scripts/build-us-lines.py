"""Builds public/geo/us-lines.json: lower-48 state borders and the national outline
(coasts and the borders with Canada and Mexico) as lon/lat lines, drawn over the model maps
so the states stay readable under any field (owner, 2026-11-02).

Source: the US Atlas (Census cartographic boundaries, 1:10m), public domain.
    python3 scripts/build-us-lines.py [path/to/states-10m.json]
"""

import json
import sys
import urllib.request

URL = "https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json"
OUT = "public/geo/us-lines.json"
# The lower 48 and a little around it: Alaska, Hawaii and the territories aren't on the model maps.
WEST, SOUTH, EAST, NORTH = -128, 23, -64, 51


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else None
    topo = json.load(open(src)) if src else json.load(urllib.request.urlopen(URL, timeout=60))
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((round(x * sx + tx, 3), round(y * sy + ty, 3)))
        arcs.append(pts)

    def arc_ids(geom):
        def walk(a):
            if isinstance(a, int):
                yield a if a >= 0 else ~a
            else:
                for b in a:
                    yield from walk(b)
        yield from walk(geom["arcs"])

    used = {}
    for g in topo["objects"]["states"]["geometries"]:
        for i in set(arc_ids(g)):
            used[i] = used.get(i, 0) + 1
    outline = set(arc_ids(topo["objects"]["nation"]["geometries"][0]))

    def inside(pts):
        return any(WEST <= x <= EAST and SOUTH <= y <= NORTH for x, y in pts)

    states = [arcs[i] for i, n in used.items() if n > 1 and inside(arcs[i])]
    nation = [arcs[i] for i in outline if inside(arcs[i])]
    out = {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "properties": {"kind": "state"},
             "geometry": {"type": "MultiLineString", "coordinates": states}},
            {"type": "Feature", "properties": {"kind": "nation"},
             "geometry": {"type": "MultiLineString", "coordinates": nation}},
        ],
    }
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"{len(states)} state border arcs, {len(nation)} outline arcs -> {OUT}")


if __name__ == "__main__":
    main()
