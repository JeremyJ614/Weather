#!/usr/bin/env python3
"""
Build the Historical Archive from NOAA SPC's tornado database.

Ported from the Log repo (scripts/build_archive.py). Weather adds the events in
events_added.py. Run: build_archive.py, build_tristate.py, build_dat_archive.py.

Rebuilt around named events (Phase 3 #10). It used to be built around *days*:
open "Joplin" and you got all forty-eight tornadoes that touched down anywhere
in the United States on 22 May 2011, including one in Hennepin County,
Minnesota, five hundred miles from Joplin. That is a database query, not an
event. Nobody calls that day "the day there were forty-eight tornadoes".

So each entry is now anchored on the tornado it is named after, and carries
that tornado plus what was happening around it — everything within about
twenty-five miles of its path, and any violent tornado near enough to be part
of the same story. The two Super Outbreaks are the exception and are built the
other way round: every F4 and F5 of the day, plus their close neighbours,
because the outbreak *is* the event there.

Source: https://www.spc.noaa.gov/wcm/data/1950-2025_actual_tornadoes.csv
The file is not committed — it is 9 MB and it is NOAA's to distribute. Fetch
it to data/reference/spc.csv and run this script (or scripts/build_all.sh).

County names come from the Census Bureau's 2020 county code list, which is
small enough to commit and lives at data/reference/counties.txt:
  https://www2.census.gov/geo/docs/reference/codes2020/national_county2020.txt

What the source gives, and what it does not
-------------------------------------------
SPC records a start point, an end point, a rating, a path length and width, a
local start time, and casualty counts. From 2010 it also records an end time,
which is new in this revision and matters: the duration of every modern track
is now the surveyed one rather than a path length divided by an assumed speed.
Before 2010 there is no end time and the old estimate stands, labelled as an
estimate.

SPC does NOT record the shape of the path between the endpoints. So the track
drawn here is a straight line between two surveyed points, and every one is
labelled so nobody mistakes an interpolation for a survey. `build_dat_archive.py`
replaces that with the real surveyed geometry wherever the Damage Assessment
Toolkit has it, which is roughly 2010 onward.

Some rows carry an end point of 0.0, 0.0 — short tornadoes where only a
touchdown was recorded. Drawn literally they run from the Midwest to the Gulf
of Guinea, so they are rebuilt as a short path from the touchdown along the
day's mean bearing, and labelled 'point'.
"""
from __future__ import annotations

import csv
import json
import math
import pathlib
import sys
from datetime import datetime, timedelta, timezone

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
SOURCE = HERE / "spc.csv"
# Census county FIPS -> name, so a tornado is named by where it hit rather
# than by a row number. SPC stores county codes (f1..f4), never names.
COUNTIES = HERE / "counties.txt"
OUT = ROOT / "public" / "archive"

# SPC magnitude -9 means the tornado was never rated.
MAG_TO_EF = {"-9": "EFU", "0": "EF0", "1": "EF1", "2": "EF2", "3": "EF3", "4": "EF4", "5": "EF5"}

# The events.
#
# `anchor` picks the tornado the event is named after: (state, magnitude,
# latitude, longitude) on `date`, matched to the nearest touchdown. `radius`
# is how far from that tornado's path something still counts as part of this
# event, in miles; `violent` is the wider radius that an F4 or F5 gets,
# because a violent tornado forty miles away on the same day is part of the
# story and an EF0 forty miles away is not.
#
# `speed` is that day's representative storm motion in mph, used only where
# SPC has no end time — 2010 onward it is ignored. `scale` names whether the
# day was rated on the Fujita or Enhanced Fujita scale, because an F5 and an
# EF5 are not the same measurement.
EVENTS = [
    dict(id="1925-03-18", name="The Tri-State Tornado", region="Missouri \u00b7 Illinois \u00b7 Indiana",
         speed=62, scale="F", source="reconstructed", tz="America/Chicago",
         blurb="The longest tornado track ever recorded and the deadliest single tornado in "
               "United States history. It pre-dates the national database by twenty-five years, "
               "so this track is a reconstruction, not a survey."),

    dict(id="1970-05-11-lubbock", name="Lubbock", region="Texas", date="1970-05-11",
         anchor=("TX", "5", 33.55, -101.90), radius=25, violent=60, speed=25, scale="F",
         tz="America/Chicago",
         blurb="The tornado that produced the Fujita scale's first F5 rating and, by wrecking "
               "a city centre with engineered buildings in it, gave Ted Fujita the damage "
               "evidence the scale was built on."),

    dict(id="1974-04-03-superoutbreak", name="The 1974 Super Outbreak", region="Thirteen states",
         date="1974-04-03", outbreak=True, radius=25, speed=50, scale="F", tz="America/Chicago",
         blurb="Thirty violent tornadoes in eighteen hours, six of them F5. Every F4 and F5 of "
               "the outbreak is here, with the tornadoes that ran alongside them."),

    dict(id="1974-04-03-xenia", name="Xenia", region="Ohio", date="1974-04-03",
         anchor=("OH", "5", 39.63, -84.05), radius=25, violent=50, speed=50, scale="F",
         tz="America/New_York",
         blurb="The Super Outbreak's signature tornado. It crossed Xenia in nine minutes, took "
               "half the town with it, and was filmed doing it."),

    dict(id="1980-06-03-grandisland", name="Grand Island", region="Nebraska", date="1980-06-03",
         anchor=("NE", "4", 40.92, -98.30), radius=25, violent=40, speed=15, scale="F",
         tz="America/Chicago",
         blurb="The Night of the Twisters. Seven tornadoes over one small city in three hours, "
               "three of them turning anticyclonically \u2014 backwards \u2014 which almost nothing does."),

    dict(id="1985-05-31-niles", name="Niles \u2014 Wheatland", region="Ohio \u00b7 Pennsylvania",
         date="1985-05-31", anchor=("OH", "5", 41.20, -81.15), radius=30, violent=60,
         speed=45, scale="F", tz="America/New_York",
         blurb="An F5 across the Ohio\u2013Pennsylvania line on an evening nobody expected one: "
               "the outbreak that proved violent tornadoes happen east of the Plains."),

    dict(id="1987-05-22-saragosa", name="Saragosa", region="Texas", date="1987-05-22",
         anchor=("TX", "4", 31.00, -103.68), radius=25, violent=50, speed=20, scale="F",
         tz="America/Chicago",
         blurb="Thirty dead in a town of four hundred. The warning went out in English to a "
               "community that largely spoke Spanish, and the lesson changed how warnings are "
               "issued."),

    dict(id="1991-04-26-andover", name="Andover", region="Kansas", date="1991-04-26",
         anchor=("KS", "5", 37.47, -97.48), radius=25, violent=60, speed=30, scale="F",
         tz="America/Chicago",
         blurb="The Golden Spur trailer park, and one of the most filmed tornadoes of its era \u2014 "
               "the day that put storm chasing on the evening news."),

    dict(id="1997-05-27-jarrell", name="Jarrell \u2014 Double Creek", region="Texas",
         date="1997-05-27", anchor=("TX", "5", 30.82, -97.62), radius=25, violent=50,
         speed=8, scale="F", tz="America/Chicago",
         blurb="It moved at walking pace and scoured the ground to bare subsoil. The slowest "
               "violent tornado on record, and the most complete destruction ever surveyed."),

    dict(id="1999-05-03-bridgecreek", name="Bridge Creek \u2014 Moore", region="Oklahoma",
         date="1999-05-03", anchor=("OK", "5", 35.13, -97.85), radius=25, violent=45,
         speed=30, scale="F", tz="America/Chicago",
         blurb="The fastest wind ever measured near the Earth's surface: 302 mph by mobile "
               "Doppler, 32 metres up, as it crossed Bridge Creek."),

    dict(id="1999-05-03-mulhall", name="Mulhall", region="Oklahoma", date="1999-05-03",
         anchor=("OK", "4", 35.88, -97.68), radius=25, violent=45, speed=30, scale="F",
         tz="America/Chicago",
         blurb="The same evening, further north, and by some measures the widest tornado ever "
               "sampled \u2014 its core flow wider than anything before or since."),

    dict(id="2002-11-10-vanwert", name="Van Wert", region="Ohio", date="2002-11-10",
         anchor=("OH", "4", 40.78, -84.77), radius=25, violent=50, speed=50, scale="F",
         tz="America/New_York",
         blurb="A November F4 across northwest Ohio. The cinema manager moved his audience into "
               "the restrooms minutes before the auditorium was destroyed."),

    dict(id="2010-05-22-bowdle", name="Bowdle", region="South Dakota", date="2010-05-22",
         anchor=("SD", "4", 45.448, -99.748), radius=25, violent=50, speed=25, scale="EF",
         tz="America/Chicago",
         blurb="A textbook wedge on the open Dakota prairie, in clear air, watched and filmed "
               "from close range for its whole life."),

    dict(id="2011-04-27-superoutbreak", name="The 2011 Super Outbreak", region="The South",
         date="2011-04-27", outbreak=True, radius=25, speed=55, scale="EF", tz="America/Chicago",
         blurb="The largest tornado outbreak ever recorded. Every EF4 and EF5 of that day is "
               "here, with the tornadoes that ran alongside them."),

    dict(id="2011-05-22-joplin", name="Joplin", region="Missouri", date="2011-05-22",
         anchor=("MO", "5", 37.05, -94.59), radius=25, violent=50, speed=20, scale="EF",
         tz="America/Chicago",
         blurb="The deadliest single tornado since modern records began in 1950. It crossed a "
               "city of fifty thousand at its widest."),

    dict(id="2011-05-24-elreno", name="El Reno \u2014 Piedmont", region="Oklahoma",
         date="2011-05-24", anchor=("OK", "5", 35.444, -98.287), radius=25, violent=45,
         speed=35, scale="EF", tz="America/Chicago",
         blurb="Sixty-three miles from El Reno to Guthrie, EF5 for much of it. Two years before "
               "the other El Reno tornado, and a different storm entirely."),

    dict(id="2013-05-31-elreno", name="El Reno", region="Oklahoma", date="2013-05-31",
         anchor=("OK", "3", 35.485, -98.096), radius=25, violent=45, speed=25, scale="EF",
         tz="America/Chicago",
         blurb="The widest tornado ever measured \u2014 2.6 miles across \u2014 and the one that killed "
               "three experienced chasers, which changed how the field thinks about distance."),

    dict(id="2019-05-27-dayton", name="Dayton \u2014 Memorial Day", region="Ohio",
         date="2019-05-27", anchor=("OH", "4", 39.824, -84.463), radius=30, violent=55,
         speed=35, scale="EF", tz="America/New_York",
         blurb="An EF4 through the northern suburbs of Dayton near midnight on Memorial Day, "
               "one of sixteen tornadoes across the region in a single night."),

    dict(id="2021-12-10-mayfield", name="Mayfield \u2014 the Quad-State tornado",
         region="Tennessee \u00b7 Kentucky", date="2021-12-10",
         anchor=("TN", "4", 36.483, -89.135), radius=25, violent=60, speed=55, scale="EF",
         tz="America/Chicago",
         blurb="A hundred and sixty-eight miles on the ground in December, across four states, "
               "through the middle of Mayfield. Fifty-seven dead."),

    dict(id="2023-03-24-rollingfork", name="Rolling Fork \u2014 Silver City", region="Mississippi",
         date="2023-03-24", anchor=("MS", "4", 32.84, -91.00), radius=25, violent=55,
         speed=55, scale="EF", tz="America/Chicago",
         blurb="Fifty-nine miles across the Mississippi Delta at nearly sixty miles an hour, "
               "through two small towns that had almost no time."),

    dict(id="2024-04-26-elkhorn", name="Elkhorn \u2014 Blair", region="Nebraska",
         date="2024-04-26", anchor=("NE", "4", 41.20, -96.33), radius=25, violent=50,
         speed=30, scale="EF", tz="America/Chicago",
         blurb="An EF4 through the northwestern edge of Omaha in the middle of the afternoon, "
               "in full view of half a city, with nobody killed."),

    dict(id="2024-05-21-greenfield", name="Greenfield", region="Iowa", date="2024-05-21",
         anchor=("IA", "4", 40.90, -94.93), radius=25, violent=50, speed=35, scale="EF",
         tz="America/Chicago",
         blurb="Mobile radar measured winds between 309 and 318 mph inside it \u2014 among the "
               "highest ever recorded in a tornado \u2014 as it crossed the town."),

    dict(id="2025-06-20-enderlin", name="Enderlin", region="North Dakota", date="2025-06-20",
         anchor=("ND", "5", 46.573, -97.603), radius=25, violent=50, speed=25, scale="EF",
         tz="America/Chicago",
         blurb="The first EF5 rated anywhere in the United States since Moore in 2013, ending "
               "a twelve-year gap that had begun to look like a change in how the scale was "
               "being applied."),
]

from events_added import NEW as _NEW
EVENTS += _NEW
EVENTS.sort(key=lambda e: e["id"])

CST = timezone(timedelta(hours=-6))


def bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initial bearing in radians from one point to another."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return math.atan2(y, x)


def project(lat: float, lon: float, bearing_rad: float, miles: float) -> tuple[float, float]:
    """A point `miles` along `bearing_rad` from a start point."""
    r = 3958.8
    d = miles / r
    p1 = math.radians(lat)
    l1 = math.radians(lon)
    p2 = math.asin(math.sin(p1) * math.cos(d) + math.cos(p1) * math.sin(d) * math.cos(bearing_rad))
    l2 = l1 + math.atan2(
        math.sin(bearing_rad) * math.sin(d) * math.cos(p1),
        math.cos(d) - math.sin(p1) * math.sin(p2),
    )
    return round(math.degrees(p2), 4), round(math.degrees(l2), 4)


# Names people actually use.
#
# SPC records county codes only on single-state rows, so the multi-state
# tornadoes — which are most of the famous ones — come through as a bare state
# abbreviation. These are keyed by (date, state, deaths, path length), which is
# unique in the source, and each was checked against the row it names.
NAMED = {
    ("1953-06-08", "MI", 116, 18.9):   "Flint–Beecher, MI",
    ("1966-03-03", "MS", 58, 202.5):   "Candlestick Park — Jackson, MS",
    ("1970-05-11", "TX", 26, 8.4):     "Lubbock, TX",
    ("1974-04-03", "OH", 36, 31.3):    "Xenia, OH",
    ("1974-04-03", "KY", 31, 32.0):    "Brandenburg, KY",
    ("1974-04-03", "AL", 28, 52.0):    "Tanner, AL",
    ("1974-04-03", "AL", 28, 79.5):    "Guin, AL",
    ("1979-04-10", "TX", 42, 46.9):    "Wichita Falls, TX",
    ("1979-04-10", "TX", 11, 39.7):    "Vernon, TX",
    ("1985-05-31", "OH", 18, 47.0):    "Niles, OH – Wheatland, PA",
    ("1990-08-28", "IL", 29, 16.4):    "Plainfield, IL",
    ("1991-04-26", "KS", 17, 46.0):    "Andover, KS",
    ("1991-04-26", "OK", 0, 66.0):     "Red Rock, OK",
    ("1997-05-27", "TX", 27, 5.1):     "Jarrell — Double Creek, TX",
    ("1998-04-08", "AL", 32, 30.3):    "Oak Grove, AL",
    ("1999-05-03", "OK", 36, 37.0):    "Bridge Creek – Moore, OK",
    ("2007-05-04", "KS", 11, 28.81):   "Greensburg, KS",
    ("2008-05-10", "OK", 21, 75.51):   "Picher, OK – Racine, MO",
    ("2011-04-27", "AL", 72, 132.0):   "Hackleburg – Phil Campbell, AL",
    ("2011-04-27", "AL", 64, 80.68):   "Tuscaloosa – Birmingham, AL",
    ("2011-04-27", "AL", 25, 36.63):   "Rainsville, AL",
    ("2011-04-27", "MS", 23, 37.1):    "Smithville, MS",
    ("2011-05-22", "MO", 158, 21.62):  "Joplin, MO",
    ("2013-05-20", "OK", 24, 13.85):   "Moore, OK",
    ("2013-05-31", "OK", 8, 16.2):     "El Reno, OK",
    ("2021-12-10", "TN", 57, 168.53):  "Mayfield, KY — the Quad-State tornado",
    ("2021-12-10", "AR", 8, 81.17):    "Monette – Leachville, AR",

    # The anchors of the named events. Without these, "Rolling Fork" opens on
    # a tornado labelled "Issaquena–Holmes, MS" — which is where SPC files it
    # and not what anybody calls it.
    ("1980-06-03", "NE", 3, 1.1):      "Grand Island, NE",
    ("1987-05-22", "TX", 30, 3.0):     "Saragosa, TX",
    ("1999-05-03", "OK", 2, 35.0):     "Mulhall, OK",
    ("2002-11-10", "OH", 4, 52.8):     "Van Wert, OH",
    ("2010-05-22", "SD", 0, 5.7):      "Bowdle, SD",
    ("2011-05-24", "OK", 9, 63.1):     "El Reno – Piedmont, OK",
    ("2019-05-27", "OH", 0, 18.17):    "Dayton – Beavercreek, OH",
    ("2023-03-24", "MS", 17, 59.23):   "Rolling Fork – Silver City, MS",
    ("2024-04-26", "NE", 0, 31.89):    "Elkhorn – Blair, NE",
    ("2024-05-21", "IA", 5, 40.65):    "Greenfield, IA",
    ("2025-06-20", "ND", 3, 12.1):     "Enderlin, ND",
}


def county_names() -> dict[tuple[str, str], str]:
    """(state FIPS, county FIPS) -> county name, minus the trailing 'County'."""
    out: dict[tuple[str, str], str] = {}
    if not COUNTIES.exists():
        return out
    with COUNTIES.open(encoding="utf-8") as fh:
        next(fh, None)
        for line in fh:
            parts = line.rstrip("\n").split("|")
            if len(parts) < 5:
                continue
            _, statefp, countyfp, _, name = parts[:5]
            trimmed = name.rsplit(" County", 1)[0] if name.endswith(" County") else name
            out[(str(int(statefp)), str(int(countyfp)))] = trimmed
    return out


COUNTY = county_names()


def where(row: dict) -> str:
    """What to call this tornado: its own name if it has one, else its counties."""
    named = NAMED.get((row["date"], row["st"], int(row["fat"] or 0), float(row["len"] or 0)))
    if named:
        return named

    seen: list[str] = []
    for key in ("f1", "f2", "f3", "f4"):
        code = row.get(key) or "0"
        if code in ("0", ""):
            continue
        name = COUNTY.get((str(int(row["stf"])), str(int(code))))
        if name and name not in seen:
            seen.append(name)
    if not seen:
        # A multi-state row with no county codes. Say how far it ran rather
        # than pretending to know where.
        return f"{row['st']} and {int(row['ns']) - 1} more" if int(row["ns"]) > 1 else row["st"]
    if len(seen) == 1:
        return f"{seen[0]}, {row['st']}"
    return f"{seen[0]}–{seen[-1]}, {row['st']}"


def load(date: str) -> list[dict]:
    """
    Every tornado on a date, and on the morning after it.

    The morning after matters: SPC files a tornado under the local calendar
    day it touched down on, and an evening outbreak keeps going past midnight.
    The Mayfield tornado is filed on 10 December and was in Kentucky on the
    11th. Taking both days and then filtering on how far apart things are in
    time is the only way to get a whole event.
    """
    nxt = (datetime.fromisoformat(date) + timedelta(days=1)).date().isoformat()
    with SOURCE.open(newline="") as fh:
        return [r for r in csv.DictReader(fh) if r["date"] in (date, nxt)]


def seg_distance_mi(a: tuple, b: tuple) -> float:
    """
    Closest approach between two tornado paths, in miles.

    Both are straight segments here, so this is the smallest distance between
    any endpoint of one and the other segment. Exact enough at these scales,
    and the alternative — a full segment-to-segment solve — would be precision
    the input does not have.
    """
    return min(
        point_to_segment_mi(a[0], a[1], *b),
        point_to_segment_mi(a[2], a[3], *b),
        point_to_segment_mi(b[0], b[1], *a),
        point_to_segment_mi(b[2], b[3], *a),
    )


def point_to_segment_mi(plat, plon, alat, alon, blat, blon) -> float:
    """Distance from a point to a segment, in miles, on a local flat earth."""
    kx = 69.0 * math.cos(math.radians(plat))
    ky = 69.0
    px, py = plon * kx, plat * ky
    ax, ay = alon * kx, alat * ky
    bx, by = blon * kx, blat * ky
    dx, dy = bx - ax, by - ay
    len2 = dx * dx + dy * dy
    if len2 == 0:
        return math.hypot(px - ax, py - ay)
    u = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / len2))
    return math.hypot(px - (ax + u * dx), py - (ay + u * dy))


def seg_of(row: dict) -> tuple:
    return (float(row["slat"]), float(row["slon"]), float(row["elat"]), float(row["elon"]))


def local_start(row: dict) -> datetime:
    hh, mm, ss = (int(x) for x in row["time"].split(":"))
    y, mo, d = (int(x) for x in row["date"].split("-"))
    return datetime(y, mo, d, hh, mm, ss, tzinfo=CST)


def local_end(row: dict) -> datetime | None:
    """
    The surveyed end time, where SPC has one.

    New in the 1950\u20132025 file and present on every row from 2010 onward. It
    replaces dividing the path length by a guess at the storm motion, which is
    what every duration in this archive used to be.
    """
    etime = (row.get("etime") or "").strip()
    edat = (row.get("edat") or "").strip()
    if not etime or not edat:
        return None
    try:
        hh, mm, ss = (int(x) for x in etime.split(":"))
        y, mo, d = (int(x) for x in edat.split("-"))
    except ValueError:
        return None
    return datetime(y, mo, d, hh, mm, ss, tzinfo=CST)


def pick_anchor(rows: list[dict], anchor: tuple) -> dict | None:
    """The row the event is named after: right state and rating, nearest point."""
    state, mag, lat, lon = anchor
    hits = [r for r in rows if r["st"] == state and r["mag"] == mag]
    if not hits:
        return None
    return min(hits, key=lambda r: (float(r["slat"]) - lat) ** 2 + (float(r["slon"]) - lon) ** 2)


VIOLENT = {"4", "5"}


def select(rows: list[dict], event: dict) -> tuple[list[dict], dict | None]:
    """
    Which of the day's tornadoes belong to this event.

    Two shapes, because the two kinds of event really are different. A named
    event is one tornado and its surroundings: everything whose path comes
    within `radius` miles of the named one, plus any violent tornado within
    the wider `violent` radius, because an F4 thirty miles away is part of
    that afternoon and an F0 thirty miles away is not.

    An outbreak has no single anchor. There the violent tornadoes *are* the
    event, so every F4 and F5 of the day is kept, along with anything running
    close alongside one.
    """
    within_hours = event.get("hours", 14)

    if event.get("outbreak"):
        cores = [r for r in rows if r["mag"] in VIOLENT]
        if not cores:
            return [], None
        base = min(local_start(r) for r in cores)
        kept = []
        for r in rows:
            if abs((local_start(r) - base).total_seconds()) > within_hours * 3600:
                continue
            if r["mag"] in VIOLENT:
                kept.append(r)
                continue
            seg = seg_of(r)
            if any(seg_distance_mi(seg, seg_of(c)) <= event["radius"] for c in cores):
                kept.append(r)
        return kept, max(cores, key=lambda r: float(r["len"] or 0))

    anchor = pick_anchor(rows, event["anchor"])
    if anchor is None:
        return [], None

    aseg = seg_of(anchor)
    astart = local_start(anchor)
    radius = event["radius"]
    violent_radius = event.get("violent", radius)

    kept = []
    for r in rows:
        if abs((local_start(r) - astart).total_seconds()) > within_hours * 3600:
            continue
        d = seg_distance_mi(seg_of(r), aseg)
        limit = violent_radius if r["mag"] in VIOLENT else radius
        if d <= limit:
            kept.append(r)
    return kept, anchor


def build(event: dict) -> dict | None:
    if "date" not in event:
        return None                      # Tri-State, built by its own script

    rows, anchor = select(load(event["date"]), event)
    if not rows:
        print(f"  {event['id']}: nothing selected", file=sys.stderr)
        return None

    # The day's mean bearing, for rebuilding tracks whose end point is missing.
    bearings = [
        bearing(float(r["slat"]), float(r["slon"]), float(r["elat"]), float(r["elon"]))
        for r in rows
        if float(r["elat"]) != 0.0 and float(r["elon"]) != 0.0
    ]
    mean_bearing = (
        math.atan2(
            sum(math.sin(b) for b in bearings) / len(bearings),
            sum(math.cos(b) for b in bearings) / len(bearings),
        )
        if bearings else math.radians(45)
    )

    # T0 is the first touchdown of the event; every time in the payload is
    # seconds from it, which is what the replay clock wants.
    starts = [local_start(r) for r in rows]
    t0 = min(starts)

    tornadoes = []
    surveyed_timing = 0
    unmeasured_width = 0
    for r, start in zip(rows, starts):
        slat, slon = float(r["slat"]), float(r["slon"])
        elat, elon = float(r["elat"]), float(r["elon"])
        length = float(r["len"] or 0)

        if elat == 0.0 or elon == 0.0:
            # Only a touchdown was recorded. Rebuild a short path along the
            # day's mean bearing rather than drawing a line to (0, 0).
            elat, elon = project(slat, slon, mean_bearing, max(length, 0.1))
            geometry = "point"
        else:
            geometry = "endpoints"

        finish = local_end(r)
        if finish and finish > start:
            duration = (finish - start).total_seconds()
            timing = "surveyed"
            surveyed_timing += 1
        else:
            duration = max(60.0, (length / max(1.0, event["speed"])) * 3600.0)
            timing = "estimated"

        offset = (start - t0).total_seconds()
        # A width SPC never really had.
        #
        # Every violent tornado in the 1974 outbreak's Kentucky and Indiana
        # rows carries a width of 10 yards, including a 68-mile F5. That is
        # not a narrow tornado, it is a field that was never filled in, and
        # drawing it literally puts a hairline where a mile-wide wedge was.
        # Recorded as 0 — which this archive already means as "not surveyed" —
        # rather than invented or drawn as fact.
        width = float(r["wid"] or 0)
        if width and width <= 10 and r["mag"] in VIOLENT:
            width = 0.0
            unmeasured_width += 1

        tornadoes.append({
            # No time in the name: the row shows the clock separately, and SPC
            # stores local STANDARD time year-round, so a raw 00:12 beside a
            # correctly-converted 1:12 AM CDT reads as a contradiction.
            "name": where(r),
            "ef": MAG_TO_EF.get(r["mag"], "EFU"),
            "start": round(offset),
            "end": round(offset + duration),
            "coords": [[round(slon, 4), round(slat, 4)], [round(elon, 4), round(elat, 4)]],
            "lengthMi": length,
            "widthYd": width,
            "inj": int(r["inj"] or 0),
            "fat": int(r["fat"] or 0),
            "state": r["st"],
            # Per-track honesty, carried all the way to the screen.
            "geometry": geometry,
            "timing": timing,
        })

    tornadoes.sort(key=lambda t: t["start"])

    if surveyed_timing == len(tornadoes):
        fidelity = "straight line between surveyed endpoints; surveyed start and end times"
    elif surveyed_timing:
        fidelity = (f"straight line between surveyed endpoints; {surveyed_timing} of "
                    f"{len(tornadoes)} durations surveyed, the rest estimated")
    else:
        fidelity = "straight line between surveyed endpoints; durations estimated"

    out = {
        "id": event["id"],
        "name": event["name"],
        "region": event["region"],
        "blurb": event["blurb"],
        "scale": event["scale"],
        "tz": event.get("tz", "America/Chicago"),
        "T0": int(t0.timestamp()),
        "source": "NOAA Storm Prediction Center tornado database (1950\u20132025)",
        "pathFidelity": fidelity,
        "torn": tornadoes,
    }
    if surveyed_timing < len(tornadoes):
        out["assumedSpeedMph"] = event["speed"]
    if unmeasured_width:
        out["caveat"] = (
            f"{unmeasured_width} of these carry no usable path width in the national "
            "database \u2014 the field holds 10 yards for tornadoes that were over a mile "
            "wide. Those are drawn without a swath rather than at a width nobody measured."
        )
    if anchor is not None and not event.get("outbreak"):
        out["anchor"] = where(anchor)
    return out


def main() -> int:
    if not SOURCE.exists():
        print(f"Missing {SOURCE}.\nFetch it with:\n"
              f"  curl -sSL -o {SOURCE} "
              f"https://www.spc.noaa.gov/wcm/data/1950-2025_actual_tornadoes.csv", file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for event in EVENTS:
        if event.get("source") == "reconstructed":
            continue  # handled by build_tristate.py — it pre-dates the database
        payload = build(event)
        if payload is None:
            print(f"  no rows for {event['id']} — skipped", file=sys.stderr)
            continue
        (OUT / f"{event['id']}.json").write_text(json.dumps(payload, separators=(",", ":")))
        index.append({
            "id": payload["id"], "name": payload["name"], "region": payload["region"],
            "blurb": payload["blurb"], "scale": payload["scale"],
            "count": len(payload["torn"]),
            "strongest": max(payload["torn"], key=lambda t: "U012345".index(t["ef"][-1]))["ef"],
            "fatalities": sum(t["fat"] for t in payload["torn"]),
            "source": "surveyed",
        })
        print(f"  {payload['id']}  {len(payload['torn']):3d} tornadoes  {payload['name']}")

    # This rewrites index.json from scratch, so any event built by another
    # script is dropped. Re-run those after this one; build_all.sh does.
    (OUT / "index.json").write_text(json.dumps(index, separators=(",", ":")))
    print(f"\n{len(index)} surveyed events written to {OUT}")
    print("Now run build_tristate.py — it adds the 1925 reconstruction to the index.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
