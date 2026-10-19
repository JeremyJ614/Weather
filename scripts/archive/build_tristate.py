#!/usr/bin/env python3
"""
Reconstruct the Tri-State Tornado of 18 March 1925.

The national tornado database begins in 1950, so this day cannot be read out of
it. The track below is assembled from the towns the tornado is documented to
have struck, in the order it struck them, with the recorded times at the places
where times were recorded. It is a reconstruction, and the payload says so at
every level so the interface can say so too.

What is solid, and what is not
------------------------------
Solid: the sequence of towns, the roughly 3.5-hour duration, the F5 rating, the
695 deaths, and a damage path reaching about a mile wide. These are documented
in the Weather Bureau's own account and in the 2013 re-analysis.

Not solid: the exact centreline between towns; whether the whole 219 miles was
one continuous tornado or a family of them — the 2013 re-analysis puts the
continuous portion at about 174 miles and extends the track further into
Indiana than the original account did.

Not included: the other tornadoes of 18 March 1925, in Tennessee, Kentucky and
Alabama. They are documented as having happened and having killed people, but
not with coordinates anyone could place on a map. Inventing paths for them
would be worse than leaving them out, so they are left out and the payload says
the day was larger than what is shown.
"""
from __future__ import annotations

import json
import math
import pathlib
from datetime import datetime, timedelta, timezone

OUT = pathlib.Path(__file__).resolve().parent.parent.parent / "public" / "archive"
CST = timezone(timedelta(hours=-6))

# Town, latitude, longitude, and the local time it was struck where recorded.
# Times in brackets in the sources are interpolated between known ones.
WAYPOINTS = [
    ("Touchdown near Ellington, Missouri", 37.2381, -90.9718, "13:01"),
    ("Annapolis, Missouri",                37.3620, -90.6996, "13:30"),
    ("Biehle, Missouri",                   37.6795, -89.8081, "14:００"),
    ("Mississippi River crossing",         37.7156, -89.4840, "14:20"),
    ("Gorham, Illinois",                   37.7186, -89.4784, "14:26"),
    ("Murphysboro, Illinois",              37.7645, -89.3351, "14:34"),
    ("De Soto, Illinois",                  37.8225, -89.2251, "14:42"),
    ("Hurst-Bush, Illinois",               37.8331, -89.1451, "14:50"),
    ("Zeigler, Illinois",                  37.9006, -89.0523, "14:58"),
    ("West Frankfort, Illinois",           37.8978, -88.9312, "15:05"),
    ("Parrish, Illinois",                  37.9067, -88.8367, "15:15"),
    ("Wabash River crossing",              38.1500, -88.0500, "16:00"),
    ("Griffin, Indiana",                   38.2031, -87.9167, "16:08"),
    ("Owensville, Indiana",                38.2731, -87.6889, "16:18"),
    ("Princeton, Indiana",                 38.3553, -87.5675, "16:26"),
    ("Dissipation near Petersburg, Indiana", 38.4500, -87.3200, "16:30"),
]


def clean(t: str) -> str:
    """One source table uses full-width digits; normalise them."""
    return t.translate(str.maketrans("０１２３４５６７８９", "0123456789"))


def haversine_miles(a: tuple[float, float], b: tuple[float, float]) -> float:
    r = 3958.8
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp = p2 - p1
    dl = math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def main() -> int:
    day = datetime(1925, 3, 18, tzinfo=CST)
    times = []
    for _, _, _, t in WAYPOINTS:
        hh, mm = (int(x) for x in clean(t).split(":"))
        times.append(day + timedelta(hours=hh, minutes=mm))

    t0 = times[0]
    coords = [[round(lon, 4), round(lat, 4)] for _, lat, lon, _ in WAYPOINTS]
    length = sum(
        haversine_miles((WAYPOINTS[i][1], WAYPOINTS[i][2]), (WAYPOINTS[i + 1][1], WAYPOINTS[i + 1][2]))
        for i in range(len(WAYPOINTS) - 1)
    )

    payload = {
        "id": "1925-03-18",
        "name": "The Tri-State Tornado",
        "region": "Missouri · Illinois · Indiana",
        "blurb": "The longest tornado track ever recorded and the deadliest single tornado in "
                 "United States history. It pre-dates the national database by twenty-five "
                 "years, so this track is a reconstruction, not a survey.",
        "scale": "F",
        "tz": "America/Chicago",
        "T0": int(t0.timestamp()),
        "source": "Reconstructed from the documented sequence of towns struck and the recorded times",
        "pathFidelity": "reconstruction from documented waypoints",
        "caveat": "The other tornadoes of 18 March 1925 — in Tennessee, Kentucky and Alabama — "
                  "are documented as having happened but not with coordinates precise enough to "
                  "place. They are left out rather than invented, so this day shows one track "
                  "where the real day had several.",
        "torn": [{
            "name": "The Tri-State Tornado",
            "ef": "EF5",  # An F5 on the original scale; shown on the F scale for this day.
            "start": 0,
            "end": int((times[-1] - t0).total_seconds()),
            "coords": coords,
            # Waypoint names and their times, so the interface can name where the
            # tornado is at any moment rather than showing a bare line.
            "waypoints": [
                {"name": name, "at": int((times[i] - t0).total_seconds())}
                for i, (name, _, _, _) in enumerate(WAYPOINTS)
            ],
            "lengthMi": round(length, 1),
            "widthYd": 1760.0,
            "inj": 2027,
            "fat": 695,
            "state": "MO/IL/IN",
            "geometry": "reconstructed",
            "timing": "documented at the towns, interpolated between them",
        }],
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "1925-03-18.json").write_text(json.dumps(payload, separators=(",", ":")))

    index_path = OUT / "index.json"
    index = json.loads(index_path.read_text()) if index_path.exists() else []
    index = [e for e in index if e["id"] != "1925-03-18"]
    index.append({
        "id": payload["id"], "name": payload["name"], "region": payload["region"],
        "blurb": payload["blurb"], "scale": payload["scale"],
        "count": 1, "strongest": "EF5", "fatalities": 695,
        "source": "reconstructed",
    })
    index.sort(key=lambda e: e["id"])
    index_path.write_text(json.dumps(index, separators=(",", ":")))

    print(f"Tri-State reconstructed: {payload['torn'][0]['lengthMi']} miles, "
          f"{len(WAYPOINTS)} waypoints, "
          f"{payload['torn'][0]['end'] // 60} minutes")
    print(f"index now holds {len(index)} events")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
