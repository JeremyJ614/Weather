"""Builds src/data/archive/spc-surveyed.json: the NWS Surveyed list's days through the last
year SPC has published.

The owner's rules (Fix-It list, 2026-11-02): every F4 and F5 before 2000; from 2000 through
2022 every violent or significant tornado (EF4 and EF5, EF3s that ran 20 miles or more or
killed someone, and EF2s that killed someone); from 2023 every tornado. SPC's database holds
every one of them complete; after its last year the list takes the NWS surveys live from the
Damage Assessment Toolkit (src/lib/archive/auto.ts).

Each qualifying tornado comes with every other tornado from SPC's database that touched down
within six hours and 400 km of it, so a day replays with its whole outbreak around it. The
app groups them into storm events the same way it groups surveyed days (src/lib/archive/group.ts).

Run once a year after SPC publishes the year's final database:
    python3 scripts/archive/build_spc_surveyed.py [path/to/1950-YYYY_actual_tornadoes.csv]
"""

import bisect
import csv
import json
import math
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

URL = "https://www.spc.noaa.gov/wcm/data/1950-2025_actual_tornadoes.csv"
OUT = "src/data/archive/spc-surveyed.json"
LAST_YEAR = 2025
CST = timezone(timedelta(hours=-6))


def qualifies(y, mag, miles, deaths):
    if y < 2000:
        return mag >= 4
    if y < 2023:
        return mag >= 4 or (mag == 3 and (miles >= 20 or deaths >= 1)) or (mag == 2 and deaths >= 1)
    return True


def km(a, b):
    r = math.pi / 180
    x = (b[0] - a[0]) * r * math.cos((a[1] + b[1]) / 2 * r)
    y = (b[1] - a[1]) * r
    return math.hypot(x, y) * 6371


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else None
    text = open(src).read() if src else urllib.request.urlopen(URL, timeout=120).read().decode()
    rows = []
    for r in csv.DictReader(text.splitlines()):
        if r["sg"] not in ("1", "-9"):
            continue
        y = int(r["yr"])
        if y > LAST_YEAR:
            continue
        tz = r["tz"]
        clock = datetime.strptime(f"{r['date']} {r['time']}", "%Y-%m-%d %H:%M:%S")
        start = clock.replace(tzinfo=timezone.utc if tz == "9" else CST)
        miles = float(r["len"] or 0)
        end = None
        if r.get("edat") and r.get("etime"):
            try:
                e = datetime.strptime(f"{r['edat']} {r['etime']}", "%Y-%m-%d %H:%M:%S")
                end = e.replace(tzinfo=timezone.utc if tz == "9" else CST)
            except ValueError:
                end = None
        if not end or end <= start or (end - start).total_seconds() > 4 * 3600:
            # About 30 mph, the usual forward speed, when the record has no end time.
            end = start + timedelta(seconds=max(60, round(miles / 30 * 3600)))
        slat, slon = float(r["slat"]), float(r["slon"])
        elat, elon = float(r["elat"] or 0), float(r["elon"] or 0)
        if not slat or not slon:
            continue
        if not elat or not elon:
            elat, elon = slat, slon
        mag, deaths = int(r["mag"]), int(r["fat"] or 0)
        rows.append(
            {
                "t0": int(start.timestamp()),
                "t1": int(end.timestamp()),
                "mag": mag,
                "a": (round(slon, 3), round(slat, 3)),
                "b": (round(elon, 3), round(elat, 3)),
                "len": round(miles, 1),
                "wid": int(float(r["wid"] or 0)),
                "fat": deaths,
                "inj": int(r["inj"] or 0),
                "st": r["st"],
                "q": qualifies(y, mag, miles, deaths),
            }
        )
    keys = [r for r in rows if r["q"]]
    keys.sort(key=lambda r: r["t0"])
    starts = [k["t0"] for k in keys]
    keep = []
    for r in rows:
        lo = bisect.bisect_left(starts, r["t0"] - 6 * 3600)
        hi = bisect.bisect_right(starts, r["t0"] + 6 * 3600)
        if r["q"] or any(km(k["a"], r["a"]) <= 400 for k in keys[lo:hi]):
            keep.append(r)
    keep.sort(key=lambda r: r["t0"])
    out = {
        "source": URL.rsplit("/", 1)[1],
        "through": LAST_YEAR,
        "rules": "F4+ before 2000; 2000-2022: EF4+, EF3 >=20 mi or deadly, EF2 deadly; every tornado from 2023; with nearby same-day tornadoes",
        # [start, end, rating (-9 unrated), lon0, lat0, lon1, lat1, miles, yards, killed, injured, state, qualifies]
        "t": [
            [r["t0"], r["t1"], r["mag"], *r["a"], *r["b"], r["len"], r["wid"], r["fat"], r["inj"], r["st"], 1 if r["q"] else 0]
            for r in keep
        ],
    }
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"{len(keys)} qualifying tornadoes, {len(keep)} with their neighbours -> {OUT}")


if __name__ == "__main__":
    main()
