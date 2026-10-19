#!/usr/bin/env python3
"""
Give the archive events the same depth an uploaded chase gets (Phase 3 #10).

The owner's requirement for the archive was that each event "must replay with
the full capacity of an uploaded chase — swath, damage points, survey points,
exact width and speed". Built from the SPC database alone, an archive event has
none of that: every track is a straight line between two surveyed endpoints,
and there is no damage, no hail and no warning anywhere in it.

This pass fills that in from the same public archives an upload uses:

  * NOAA's Damage Assessment Toolkit — the real surveyed centreline, the EF
    contour polygons that are the actual damage swath, and every damage point
    the survey walked. Coverage begins around 2002 and is patchy until about
    2019; where it has nothing, the straight-line track stands and says so.
  * The Iowa Environmental Mesonet — local storm reports for hail, and the
    storm-based warning archive, which begins in 2002.

Nothing here invents anything. An event the archives do not cover keeps
exactly what it had, and the `pathFidelity` line on each event says which of
the two it is.

Usage:
    python3 scripts/build_dat_archive.py                 # every event
    python3 scripts/build_dat_archive.py 2024-05-21-greenfield
"""

from __future__ import annotations

import json
import math
import pathlib
import sys
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
ARCHIVE = ROOT / "public" / "archive"

DAT = ("https://services.dat.noaa.gov/arcgis/rest/services"
       "/nws_damageassessmenttoolkit/DamageViewer/MapServer")
LSR = "https://mesonet.agron.iastate.edu/geojson/lsr.geojson"
SBW = "https://mesonet.agron.iastate.edu/api/1/vtec/sbw_interval.geojson"

LAYER_POINTS, LAYER_LINES, LAYER_POLYGONS = 0, 1, 2
PAGE = 2000

# How far the DAT track's start may be from the SPC touchdown, and how far
# apart their start times may be, for the two to be the same tornado. SPC
# records a local standard time to the minute and DAT records the survey's
# own; twenty minutes and twenty miles is loose enough to match and tight
# enough not to pair two tornadoes from the same squall line.
MATCH_MILES = 20.0
MATCH_MINUTES = 40

# Damage further than this from any track in the event is somebody else's.
ATTRIBUTION_MILES = 3.1        # five kilometres, as the upload pipeline uses

MIN_HAIL_INCHES = 0.75

# For checking that two records describe the same tornado.
EF_NUM = {"EFU": -1, "EF0": 0, "EF1": 1, "EF2": 2, "EF3": 3, "EF4": 4, "EF5": 5}

# The wind speeds each rating is defined by, in mph. These are not a
# heuristic: they are what the Enhanced Fujita scale *is*, so a record
# claiming 180 mph cannot belong to a tornado the survey rated EF1.
#
# The Damage Assessment Toolkit sometimes files one tornado as several
# segments, each carrying the whole event's summary width and wind. Without
# this check a short segment of the Greenfield EF4 attached itself to a
# 1.7-mile EF1 that touched down nearby, and that EF1 then claimed 1,600
# yards and 180 mph on its card.
EF_WIND = {
    "EF0": (65, 85), "EF1": (86, 110), "EF2": (111, 135),
    "EF3": (136, 165), "EF4": (166, 200), "EF5": (201, 350),
}
PAD_DEG = 0.4
PAD_HOURS = 3


def get(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=120) as r:
        return json.load(r)


def stamp(epoch: float) -> str:
    import datetime as dt
    return dt.datetime.fromtimestamp(epoch, dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def iso(epoch: float, fmt: str) -> str:
    import datetime as dt
    return dt.datetime.fromtimestamp(epoch, dt.timezone.utc).strftime(fmt)


def miles(lat1, lon1, lat2, lon2) -> float:
    kx = 69.0 * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot((lon2 - lon1) * kx, (lat2 - lat1) * 69.0)


def point_to_segment_mi(plat, plon, alat, alon, blat, blon) -> float:
    kx = 69.0 * math.cos(math.radians(plat))
    px, py, ax, ay, bx, by = plon * kx, plat * 69, alon * kx, alat * 69, blon * kx, blat * 69
    dx, dy = bx - ax, by - ay
    len2 = dx * dx + dy * dy
    if len2 == 0:
        return math.hypot(px - ax, py - ay)
    u = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / len2))
    return math.hypot(px - (ax + u * dx), py - (ay + u * dy))


def nearest_track(lat: float, lon: float, tracks: list[list]) -> int:
    """Which tornado a point belongs to, by distance to its path. -1 for none."""
    best, best_d = -1, ATTRIBUTION_MILES
    for i, coords in enumerate(tracks):
        if len(coords) == 1:
            d = miles(lat, lon, coords[0][1], coords[0][0])
        else:
            d = min(
                point_to_segment_mi(lat, lon, a[1], a[0], b[1], b[0])
                for a, b in zip(coords, coords[1:])
            )
        if d < best_d:
            best, best_d = i, d
    return best


def query(layer: int, where: str, bbox: tuple, fields: str, geometry: bool) -> list[dict]:
    out: list[dict] = []
    offset = 0
    while True:
        qs = urllib.parse.urlencode({
            "where": where,
            "geometry": "%f,%f,%f,%f" % bbox,
            "geometryType": "esriGeometryEnvelope",
            "inSR": "4326", "outSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": fields,
            "returnGeometry": "true" if geometry else "false",
            "resultOffset": str(offset),
            "resultRecordCount": str(PAGE),
            "f": "json",
        })
        data = get(f"{DAT}/{layer}/query?{qs}")
        if "error" in data:
            raise RuntimeError(data["error"].get("message", "DAT refused the query"))
        page = data.get("features", [])
        out.extend(page)
        if len(page) < PAGE or offset > PAGE * 20:
            break
        offset += PAGE
    return out


def num(v, fallback: float = 0.0) -> float:
    """
    A number, whatever the survey actually wrote in the field.

    DAT's numeric fields are strings, and a surveyor who did not estimate a
    wind speed types "N/A" into one. Every one of these has to be coerced
    defensively or a single such row stops a whole event importing.
    """
    try:
        return float(v)
    except (TypeError, ValueError):
        return fallback


def ef_of(raw) -> str:
    s = str(raw or "").upper().strip()
    if s.startswith("EF") and s[2:3].isdigit():
        return s[:3]
    if s.isdigit():
        return f"EF{s}"
    return "EFU"


def enrich(path: pathlib.Path) -> bool:
    event = json.loads(path.read_text())
    torn = event.get("torn", [])
    if not torn:
        return False

    t0 = int(event["T0"])
    # Everything in the event, with room either side.
    lats = [c[1] for t in torn for c in t["coords"]]
    lons = [c[0] for t in torn for c in t["coords"]]
    bbox = (min(lons) - PAD_DEG, min(lats) - PAD_DEG, max(lons) + PAD_DEG, max(lats) + PAD_DEG)
    begin = t0 + min(t["start"] for t in torn) - PAD_HOURS * 3600
    finish = t0 + max(t["end"] for t in torn) + PAD_HOURS * 3600

    # `stormdate` is the storm's local date and an evening event lands on both
    # sides of UTC midnight, so the net is a day wider each way and the real
    # timestamps do the filtering.
    day = 86400
    where = (f"stormdate >= timestamp '{stamp(begin - day)}' "
             f"AND stormdate < timestamp '{stamp(finish + day)}'")

    lines = query(LAYER_LINES, where, bbox,
                  "objectid,event_id,wfo,efscale,starttime,endtime,width,maxwind,comments", True)

    # --- match DAT tracks onto the SPC tornadoes this event already has ---
    #
    # Best pair first, globally, rather than walking the tornadoes in order
    # and giving each one its nearest unused track.
    #
    # The greedy version got this wrong in a way that was invisible until you
    # read a card: on the Greenfield day it handed the EF4's surveyed width
    # and wind estimate to a 1.7-mile EF1 that happened to be earlier in the
    # list, and gave the EF4 the small one's numbers. Both tornadoes then
    # looked plausible and both were wrong. Scoring every pair and taking the
    # best one first cannot do that, because the closest pair in the whole
    # set is always right if any pairing is.
    candidates = []
    for ti, t in enumerate(torn):
        s_lat, s_lon = t["coords"][0][1], t["coords"][0][0]
        t_start = t0 + t["start"]
        for li, f in enumerate(lines):
            paths = f.get("geometry", {}).get("paths") or []
            pts = [p for path in paths for p in path]
            if len(pts) < 2:
                continue
            start_ms = f["attributes"].get("starttime")
            gap = abs(start_ms / 1000 - t_start) if start_ms else None
            if gap is not None and gap > MATCH_MINUTES * 60:
                continue
            d = min(miles(s_lat, s_lon, pts[0][1], pts[0][0]),
                    miles(s_lat, s_lon, pts[-1][1], pts[-1][0]))
            if d > MATCH_MILES:
                continue
            # Two more things have to agree, because distance and time alone
            # are not enough on an outbreak day.
            #
            # On the Greenfield day a 1.7-mile EF1 touched down close enough
            # in space and time to the 40-mile EF4 that distance alone handed
            # it the EF4's width and wind estimate. An EF1 is not 1,600 yards
            # wide with 180 mph winds, and the two records say so themselves.
            spc_ef = EF_NUM.get(t.get("ef", "EFU"), -1)
            dat_ef = EF_NUM.get(ef_of(f["attributes"].get("efscale")), -1)
            if spc_ef >= 0 and dat_ef >= 0 and abs(spc_ef - dat_ef) > 1:
                continue

            # A wind estimate outside the SPC rating's own band is a record
            # describing a different tornado, whatever its coordinates say.
            band = EF_WIND.get(t.get("ef", ""))
            wind = num(f["attributes"].get("maxwind"))
            if band and wind > 0 and not (band[0] - 15 <= wind <= band[1] + 15):
                continue

            # And a 40-mile track is not the same tornado as a 2-mile one,
            # however close their touchdowns were.
            dat_len = sum(miles(a[1], a[0], b[1], b[0]) for a, b in zip(pts, pts[1:]))
            spc_len = float(t.get("lengthMi") or 0)
            if spc_len > 1 and dat_len > 1:
                ratio = max(spc_len, dat_len) / min(spc_len, dat_len)
                if ratio > 3:
                    continue

            # Distance decides, with the time gap breaking ties: two tornadoes
            # from the same supercell can touch down a mile apart, and then
            # the clock is the only thing that tells them apart.
            score = d + (gap or 0) / 600.0
            candidates.append((score, d, ti, li))

    candidates.sort()
    used_lines: set[int] = set()
    used_torn: set[int] = set()
    matched = 0
    for _score, _d, ti, li in candidates:
        if ti in used_torn or li in used_lines:
            continue
        used_torn.add(ti)
        used_lines.add(li)
        matched += 1

        t = torn[ti]
        f = lines[li]
        a = f["attributes"]
        pts = [p for path in f["geometry"]["paths"] for p in path]
        s_lat, s_lon = t["coords"][0][1], t["coords"][0][0]
        # Walk it the same way the SPC row does, so the replay moves the
        # right direction along it.
        if miles(s_lat, s_lon, pts[0][1], pts[0][0]) > miles(s_lat, s_lon, pts[-1][1], pts[-1][0]):
            pts = list(reversed(pts))
        t["coords"] = [[round(p[0], 5), round(p[1], 5)] for p in pts]
        t["geometry"] = "surveyed"
        if num(a.get("width")) > 0:
            t["widthYd"] = num(a["width"])
        if num(a.get("maxwind")) > 0:
            t["maxwind"] = int(num(a["maxwind"]))
        if (a.get("comments") or "").strip():
            t["comments"] = a["comments"].strip()
        if (a.get("wfo") or "").strip():
            t["wfo"] = a["wfo"].strip()

    tracks = [t["coords"] for t in torn]

    # --- the surveyed contours: the real swath shape ---
    polys = []
    if matched:
        for f in query(LAYER_POLYGONS, where, bbox, "objectid,efscale", True):
            for ring in (f.get("geometry", {}).get("rings") or []):
                if len(ring) < 4:
                    continue
                mid = ring[len(ring) // 2]
                ti = nearest_track(mid[1], mid[0], tracks)
                if ti < 0:
                    continue
                polys.append({"t": ti, "ef": ef_of(f["attributes"].get("efscale")),
                              "ring": [[round(c[0], 5), round(c[1], 5)] for c in ring]})

    # --- damage points ---
    dpts = []
    if matched:
        for f in query(LAYER_POINTS, where, bbox,
                       "objectid,efscale,damage_txt,dod_txt,windspeed,lat,lon", False):
            a = f["attributes"]
            lat, lon = num(a.get("lat"), float("nan")), num(a.get("lon"), float("nan"))
            if math.isnan(lat) or math.isnan(lon):
                continue
            ti = nearest_track(lat, lon, tracks)
            if ti < 0:
                continue
            dpts.append([round(lat, 5), round(lon, 5),
                         (str(a.get("efscale") or "").strip() or "EFU"),
                         int(num(a.get("windspeed"))),
                         str(a.get("damage_txt") or ""), str(a.get("dod_txt") or ""), ti])

    # --- hail, and the warnings that were out ---
    hail, warns = [], []
    try:
        qs = urllib.parse.urlencode({"sts": iso(begin, "%Y-%m-%dT%H:%MZ"),
                                     "ets": iso(finish, "%Y-%m-%dT%H:%MZ")})
        seen = set()
        for f in get(f"{LSR}?{qs}").get("features", []):
            p = f["properties"]
            if p.get("type") != "H":
                continue
            mag = num(p.get("magf"), -1)
            lat, lon = p.get("lat"), p.get("lon")
            if mag < MIN_HAIL_INCHES or lat is None or lon is None:
                continue
            if not (bbox[0] <= lon <= bbox[2] and bbox[1] <= lat <= bbox[3]):
                continue
            import datetime as dt
            at = dt.datetime.fromisoformat(p["valid"].replace("Z", "+00:00")).timestamp()
            t = round(at - t0, 1)
            key = (round(lat, 2), round(lon, 2), round(mag, 2), int(t // 300))
            if key in seen:
                continue
            seen.add(key)
            city, st = (p.get("city") or "").strip(), (p.get("st") or "").strip()
            hail.append([t, round(float(lat), 5), round(float(lon), 5), round(mag, 2),
                         f"{city}, {st}" if city and st else (city or st or "Unknown"),
                         (p.get("source") or "").strip(),
                         (p.get("remark") or "").strip()[:220]])
        hail.sort(key=lambda h: h[0])
    except Exception as err:                                   # noqa: BLE001
        print(f"    hail unavailable: {err}", file=sys.stderr)

    # The storm-based warning archive begins in 2002. Asking for 1974 is not
    # an error, it just comes back empty — so do not ask.
    if event["id"] >= "2002":
        try:
            qs = urllib.parse.urlencode(
                [("begints", iso(begin, "%Y-%m-%dT%H:%M:%SZ")),
                 ("endts", iso(finish, "%Y-%m-%dT%H:%M:%SZ")),
                 ("ph", "TO"), ("ph", "SV"), ("only_new", "true")])
            import datetime as dt
            for f in get(f"{SBW}?{qs}").get("features", []):
                p, g = f["properties"], f["geometry"]
                rings = ([g["coordinates"][0]] if g["type"] == "Polygon"
                         else [poly[0] for poly in g["coordinates"]]
                         if g["type"] == "MultiPolygon" else [])
                for ring in rings:
                    rl = [c[0] for c in ring]
                    ra = [c[1] for c in ring]
                    if max(rl) < bbox[0] or min(rl) > bbox[2]:
                        continue
                    if max(ra) < bbox[1] or min(ra) > bbox[3]:
                        continue
                    fr = dt.datetime.fromisoformat(
                        (p.get("utc_polygon_begin") or p["utc_issue"]).replace("Z", "+00:00"))
                    to = dt.datetime.fromisoformat(
                        (p.get("utc_polygon_end") or p["utc_expire"]).replace("Z", "+00:00"))
                    warns.append({
                        "kind": ("severe" if p.get("phenomena") != "TO"
                                 else "emergency" if p.get("is_emergency") else "tornado"),
                        "from": round(fr.timestamp() - t0, 1),
                        "to": round(to.timestamp() - t0, 1),
                        "label": p.get("event_label", "Warning"),
                        "wfo": p.get("wfo", ""), "id": p.get("product_id", ""),
                        "where": p.get("locations", ""),
                        "ring": [[round(c[0], 5), round(c[1], 5)] for c in ring],
                    })
        except Exception as err:                               # noqa: BLE001
            print(f"    warnings unavailable: {err}", file=sys.stderr)

    if polys:
        event["polys"] = polys
    if dpts:
        event["dpts"] = dpts
    if hail:
        event["hail"] = hail
    if warns:
        event["warns"] = warns

    if matched:
        event["pathFidelity"] = (
            f"{matched} of {len(torn)} tracks are the surveyed centreline from NOAA's "
            "Damage Assessment Toolkit; the rest are straight lines between surveyed "
            "endpoints"
            if matched < len(torn)
            else "surveyed centrelines from NOAA's Damage Assessment Toolkit"
        )

    path.write_text(json.dumps(event, separators=(",", ":")))
    print(f"  {event['id']:30} tracks {matched}/{len(torn)}  contours {len(polys):4}  "
          f"damage {len(dpts):5}  hail {len(hail):4}  warnings {len(warns):4}")
    return True


def main() -> int:
    only = sys.argv[1] if len(sys.argv) > 1 else None
    files = sorted(p for p in ARCHIVE.glob("*.json") if p.name != "index.json")
    if only:
        files = [p for p in files if p.stem == only]
        if not files:
            print(f"No archive event called {only}", file=sys.stderr)
            return 1
    for p in files:
        try:
            enrich(p)
        except Exception as err:                               # noqa: BLE001
            print(f"  {p.stem}: {err}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
