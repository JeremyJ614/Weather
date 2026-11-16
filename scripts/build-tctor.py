"""
Hurricane Tornadoes calibration (post-launch A6) from SPC's TCTOR database (Edwards; every
tornado tied to a tropical cyclone since 1995): how tornado counts fall off with distance from
the center (50 km bands) and around the storm relative to its motion (45-degree sectors).
Needs xlrd.  python3 scripts/build-tctor.py  ->  src/lib/engines/tctor-climo.json
"""
import collections, io, json, math, urllib.request
import xlrd

URL = "https://www.spc.noaa.gov/publications/edwards/tctor.xls"
req = urllib.request.Request(URL, headers={"User-Agent": "StormSync Weather (https://weather.sswx.space)"})
sheet = xlrd.open_workbook(file_contents=urllib.request.urlopen(req).read()).sheet_by_index(0)
rows = []
for r in range(1, sheet.nrows):
    v = sheet.row_values(r)
    try:
        rows.append((int(v[0]), float(v[36]), float(v[35]), float(v[25]), float(v[26]), float(v[31]), float(v[32])))
    except (ValueError, TypeError):
        pass
bands = collections.Counter(min(15, int(d // 50)) for _, d, *_ in rows)
sectors = collections.Counter()
for _, _, brg, la0, lo0, la1, lo1 in rows:
    if abs(la1 - la0) + abs(lo1 - lo0) < 0.05:
        continue
    # TCTOR longitudes are degrees west.
    motion = math.degrees(math.atan2(-(lo1 - lo0) * math.cos(math.radians(la0)), la1 - la0)) % 360
    sectors[int(((brg - motion) % 360) // 45)] += 1
top_b, top_s = max(bands.values()), max(sectors.values())
d = sorted(x[1] for x in rows)
out = {
    "source": "SPC TCTOR (Edwards), " + f"{min(r[0] for r in rows)}-{max(r[0] for r in rows)}",
    "n": len(rows),
    "radial50km": [round(bands.get(i, 0) / top_b, 3) for i in range(16)],
    "motion45": [round(sectors.get(i, 0) / top_s, 3) for i in range(8)],
    "medianKm": round(d[len(d) // 2]),
    "p90Km": round(d[int(0.9 * len(d))]),
}
open("src/lib/engines/tctor-climo.json", "w").write(json.dumps(out) + "\n")
print(out)
