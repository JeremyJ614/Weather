"""
Builds the 7-day maps (owner's Fix it List #39, step 2): the Flooding Outlook's rain that fell
over the last week and the Winter Center's snow, drawn on the app's own national map. Run by
the daily data job (.github/workflows/data.yml):

    python3 scripts/build-sevenday.py rain --out site/rain
    python3 scripts/build-sevenday.py snow --out site/snow

Sources (public, free):
  rain  NOAA MRMS multi-sensor (radar + gauge) 6-hour precipitation, Pass 2, 1 km, from NOAA's
        open data on AWS: 28 six-hour steps ending at the newest 00, 06, 12 or 18 UTC
  snow  NOAA NOHRSC's National Snowfall Analysis (v2), 24-hour snowfall ending 12 UTC, 4 km:
        the last 7 days
  both  Local Storm Reports from the National Weather Service via the Iowa Environmental
        Mesonet: flood, flash flood and coastal flood reports (rain), snow reports (snow)

Writes into --out:
  d00.webp … dNN.webp  what each step added, on the app's 975x610 Albers canvas at 2x
                     (1950x1220): the running total is one gray byte per pixel coded by `CODES`
                     below (0 = none, outside the lower 48 left empty), and each file holds the
                     rise in that code since the step before (lossless WebP), so adding them
                     up gives every step's total exactly and most of each file is empty
  total.webp         the whole week's total codes in one file (what the map shows first)
  meta.json          the steps' times, the code table, the totals at every city that got any,
                     the biggest total and where, and the reports
"""

import gzip
import io
import json
import math
import os
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..")
SCALE = 2
W, H = 975 * SCALE, 610 * SCALE

# Gray code -> inches, by product: fine steps for light amounts, coarser for big ones.
CODES = {
    # rain: 0.01" to 1" by 0.01, to 5" by 0.05, to 30" by 1/3
    "rain": [(1, 100, 0.01, 0.0), (101, 180, 0.05, 1.0), (181, 255, 1 / 3, 5.0)],
    # snow: 0.1" to 10" by 0.1, to 50" by 0.5, to 200" by 2
    "snow": [(1, 100, 0.1, 0.0), (101, 180, 0.5, 10.0), (181, 255, 2.0, 50.0)],
}


def code_values(kind):
    """Inches at every gray code (index 0 is none)."""
    v = np.zeros(256)
    for c0, c1, step, base in CODES[kind]:
        for c in range(c0, c1 + 1):
            v[c] = base + (c - c0 + 1) * step
    return v


def encode(kind, inches):
    """Inches -> gray codes (nearest code at or below; anything below the first step is 0)."""
    table = code_values(kind)
    idx = np.searchsorted(table[1:], inches + 1e-6, side="right")
    return np.clip(idx, 0, 255).astype(np.uint8)


# --- The app's Albers USA canvas (src/lib/map/usAlbers.ts, lower 48 lobe) -----------------
R = math.pi / 180
K, TX, TY = 1300, 487.5, 305
P0, P1 = 29.5 * R, 45.5 * R
N = (math.sin(P0) + math.sin(P1)) / 2
C = 1 + math.sin(P0) * (2 * N - math.sin(P0))
R0 = math.sqrt(C) / N


def raw(lon, lat):
    x = (lon + 96) * R * N
    r = np.sqrt(C - 2 * N * np.sin(lat * R)) / N
    return r * np.sin(x), R0 - r * np.cos(x)


CX, CY = raw(-96 - 0.6, 38.7)


def forward(lon, lat):
    X, Y = raw(np.asarray(lon, float), np.asarray(lat, float))
    return TX + K * (X - CX), TY - K * (Y - CY)


def inverse(sx, sy):
    X = (sx - TX) / K + CX
    Y = CY - (sy - TY) / K
    r0y = R0 - Y
    lon = np.arctan2(X, np.abs(r0y)) / N * np.sign(np.where(r0y == 0, 1, r0y))
    lat = np.arcsin(np.clip((C - (X * X + r0y * r0y) * N * N) / (2 * N), -1, 1))
    return lon / R - 96, lat / R


def nation_mask():
    """The lower 48's outline from the app's own base map, filled at 2x (Alaska and Hawaii left out)."""
    d = json.load(open(os.path.join(ROOT, "src/lib/map/data/usNationAlbers.json")))["nation"]
    im = Image.new("L", (W, H), 0)
    dr = ImageDraw.Draw(im)
    for ring in d.split("Z"):
        pts = [(float(x) * SCALE, float(y) * SCALE) for x, y in re.findall(r"([-\d.]+) ([-\d.]+)", ring)]
        if len(pts) < 3:
            continue
        # The insets sit in the lower left: x under 300 and y over 430 on the canvas.
        cx = sum(p[0] for p in pts) / len(pts) / SCALE
        cy = sum(p[1] for p in pts) / len(pts) / SCALE
        if cx < 300 and cy > 430:
            continue
        dr.polygon(pts, fill=255)
    return np.array(im) > 0


def grid_lonlat():
    xs = (np.arange(W) + 0.5) / SCALE
    ys = (np.arange(H) + 0.5) / SCALE
    gx, gy = np.meshgrid(xs, ys)
    return inverse(gx, gy)


def sampler(lon, lat, lon0, lat0, dlon, dlat, shape):
    """Bilinear weights from canvas pixels into a regular grid (top-left origin, dlat < 0)."""
    fx = (lon - lon0) / dlon
    fy = (lat - lat0) / dlat
    x0 = np.floor(fx).astype(int)
    y0 = np.floor(fy).astype(int)
    ok = (x0 >= 0) & (y0 >= 0) & (x0 < shape[1] - 1) & (y0 < shape[0] - 1)
    x0 = np.clip(x0, 0, shape[1] - 2)
    y0 = np.clip(y0, 0, shape[0] - 2)
    ax = fx - x0
    ay = fy - y0

    def at(a):
        v = (
            a[y0, x0] * (1 - ax) * (1 - ay)
            + a[y0, x0 + 1] * ax * (1 - ay)
            + a[y0 + 1, x0] * (1 - ax) * ay
            + a[y0 + 1, x0 + 1] * ax * ay
        )
        return np.where(ok, v, 0.0)

    return at


def fetch(url, tries=3):
    last = None
    for _ in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return r.read()
        except OSError as e:
            last = e
    raise last


def cities():
    """US places from the app's Census list: name, state, lat, lon, population (biggest first)."""
    text = open(os.path.join(ROOT, "src/lib/geo/places.data.ts")).read()
    body = re.search(r'PLACES = "(.*)";', text, re.S).group(1)
    out = []
    for line in body.split("\\n"):
        p = line.split("|")
        if len(p) == 5 and int(p[4]) >= 15000:
            out.append((p[0], p[1], float(p[2]), float(p[3]), int(p[4])))
    return out


def reports(kind, start, end):
    """NWS Local Storm Reports in the window: floods (rain) or snowfall amounts (snow)."""
    url = (
        "https://mesonet.agron.iastate.edu/geojson/lsr.geojson?"
        f"sts={start:%Y%m%d%H%M}&ets={end:%Y%m%d%H%M}"
    )
    try:
        feats = json.loads(fetch(url))["features"]
    except Exception as e:  # noqa: BLE001 - reports are extra; the map stands without them
        print(f"reports failed: {e}")
        return []
    keep = {"rain": {"E": "Flood", "F": "Flash flood", "v": "Coastal flood"}, "snow": {"S": "Snow"}}[kind]
    out = []
    for f in feats:
        p = f["properties"]
        t = p.get("type")
        if t not in keep or p.get("lat") is None:
            continue
        mag = p.get("magf")
        if kind == "snow" and not mag:
            continue
        when = datetime.fromisoformat(p["valid"].replace("Z", "+00:00"))
        x, y = forward(p["lon"], p["lat"])
        if not (0 <= x <= 975 and 0 <= y <= 610):
            continue
        out.append(
            {
                "x": round(float(x), 1),
                "y": round(float(y), 1),
                "t": round((when - start).total_seconds() / 3600, 1),
                "k": keep[t],
                "m": mag,
                "at": f"{p.get('city', '').strip()}, {p.get('st', '')}".strip(", "),
                "r": (p.get("remark") or "")[:220],
            }
        )
    out.sort(key=lambda r: r["t"])
    # Snow: the biggest amounts first if there are a great many.
    if kind == "snow" and len(out) > 900:
        out = sorted(out, key=lambda r: -(r["m"] or 0))[:900]
        out.sort(key=lambda r: r["t"])
    return out[:900]


def where(places, lat, lon):
    """'Cocoa, FL', or '62 mi ENE of Clovis, CA' when the nearest town is more than 15 miles off."""
    def dist(p):
        x = (p[3] - lon) * math.cos(lat * R)
        y = p[2] - lat
        return math.hypot(x, y) * 69.1, math.degrees(math.atan2(-x, -y)) % 360

    # Prefer a bigger town when it's nearly as close.
    best = min(places, key=lambda p: dist(p)[0] - min(10, math.log10(max(p[4], 1)) * 1.5))
    mi, b = dist(best)
    if mi <= 15:
        return f"{best[0]}, {best[1]}"
    pts = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    return f"{round(mi)} mi {pts[round(b / 22.5) % 16]} of {best[0]}, {best[1]}"


# --- Rain: MRMS 6-hour multi-sensor QPE ----------------------------------------------------
MRMS = "https://noaa-mrms-pds.s3.amazonaws.com/CONUS/MultiSensor_QPE_06H_Pass2_00.00"


def mrms_url(t):
    return f"{MRMS}/{t:%Y%m%d}/MRMS_MultiSensor_QPE_06H_Pass2_00.00_{t:%Y%m%d-%H%M%S}.grib2.gz"


def mrms_grid(t):
    import pygrib

    data = gzip.decompress(fetch(mrms_url(t)))
    path = "/tmp/mrms.grib2"
    with open(path, "wb") as f:
        f.write(data)
    g = pygrib.open(path).message(1)
    v = g.values
    v = np.where(np.ma.getmaskarray(v), 0, np.ma.getdata(v)) if np.ma.isMaskedArray(v) else v
    lat1, lon1 = g["latitudeOfFirstGridPointInDegrees"], g["longitudeOfFirstGridPointInDegrees"]
    di, dj = g["iDirectionIncrementInDegrees"], g["jDirectionIncrementInDegrees"]
    lon1 = lon1 - 360 if lon1 > 180 else lon1
    v = np.where(v > 0, v, 0.0) / 25.4  # mm -> inches; MRMS marks missing as negative
    # First row is the north edge (MRMS scans north to south).
    if g["jScansPositively"]:
        v = v[::-1]
        lat1 = lat1 + dj * (v.shape[0] - 1)
    return v, lon1, lat1, di, -dj


def rain_steps():
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    end = now - timedelta(hours=now.hour % 6)
    for _ in range(4):
        try:
            urllib.request.urlopen(urllib.request.Request(mrms_url(end), method="HEAD"), timeout=30)
            break
        except OSError:
            end -= timedelta(hours=6)
    return [end - timedelta(hours=6 * k) for k in range(27, -1, -1)]


# --- Snow: NOHRSC 24-hour snowfall ---------------------------------------------------------
NOHRSC = "https://www.nohrsc.noaa.gov/snowfall/data"


def nohrsc_grid(t):
    url = f"{NOHRSC}/{t:%Y%m}/sfav2_CONUS_24h_{t:%Y%m%d%H}.tif"
    im = Image.open(io.BytesIO(fetch(url)))
    v = np.array(im, dtype=np.float32)
    v = np.where(v > 0, v, 0.0)
    scale = im.tag_v2.get(33550)  # pixel size (deg)
    tie = im.tag_v2.get(33922)  # (i, j, k, lon, lat, z) of the top-left corner
    d = float(scale[0])
    # Tie point is the corner of the first pixel; sample at pixel centers.
    return v, float(tie[3]) + d / 2, float(tie[4]) - d / 2, d, -float(scale[1])


def snow_steps():
    now = datetime.now(timezone.utc)
    end = now.replace(hour=12, minute=0, second=0, microsecond=0)
    if end > now:
        end -= timedelta(days=1)
    for _ in range(3):
        url = f"{NOHRSC}/{end:%Y%m}/sfav2_CONUS_24h_{end:%Y%m%d%H}.tif"
        try:
            urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=30)
            break
        except OSError:
            end -= timedelta(days=1)
    return [end - timedelta(days=k) for k in range(6, -1, -1)]


def main(kind, out):
    os.makedirs(out, exist_ok=True)
    steps = rain_steps() if kind == "rain" else snow_steps()
    span = timedelta(hours=6) if kind == "rain" else timedelta(days=1)
    start = steps[0] - span
    mask = nation_mask()
    glon, glat = grid_lonlat()
    places = cities()
    plon = np.array([p[3] for p in places])
    plat = np.array([p[2] for p in places])
    total = None
    prev = np.zeros((H, W), np.uint8)
    city_total = np.zeros(len(places))
    city_series = []
    sample_px = sample_city = None
    for k, t in enumerate(steps):
        v, lon0, lat0, dlon, dlat = (mrms_grid if kind == "rain" else nohrsc_grid)(t)
        if kind == "rain":
            # Average 2x2 blocks first (1 km to 2 km), so sampling at 2.4 km doesn't alias.
            h2, w2 = v.shape[0] // 2 * 2, v.shape[1] // 2 * 2
            v = v[:h2, :w2].reshape(h2 // 2, 2, w2 // 2, 2).mean(axis=(1, 3))
            lon0, lat0 = lon0 + dlon / 2, lat0 + dlat / 2
            dlon, dlat = dlon * 2, dlat * 2
        if sample_px is None:
            sample_px = sampler(glon, glat, lon0, lat0, dlon, dlat, v.shape)
            sample_city = sampler(plon, plat, lon0, lat0, dlon, dlat, v.shape)
        step = np.where(mask, sample_px(v), 0.0)
        total = step if total is None else total + step
        city_total = city_total + sample_city(v)
        city_series.append(city_total.copy())
        codes = encode(kind, total)
        Image.fromarray(codes - prev).save(os.path.join(out, f"d{k:02d}.webp"), "WEBP", lossless=True, quality=100, method=6)
        prev = codes
        print(f"{kind} {t:%Y-%m-%d %H}Z  max {total.max():.2f} in")
    # The week's total in one file, so the map shows it at once (the steps load behind it).
    Image.fromarray(prev).save(os.path.join(out, "total.webp"), "WEBP", lossless=True, quality=100, method=6)
    series = np.array(city_series)  # steps x cities
    cx, cy = forward(plon, plat)
    inside = (cx >= 0) & (cx <= 975) & (cy >= 0) & (cy <= 610)
    ix = np.clip((cx * SCALE).astype(int), 0, W - 1)
    iy = np.clip((cy * SCALE).astype(int), 0, H - 1)
    inside &= mask[iy, ix]
    least = 0.1 if kind == "rain" else 0.5
    rows = []
    for i, p in enumerate(places):
        if not inside[i] or series[-1, i] < least:
            continue
        rows.append([p[0], p[1], round(float(cx[i]), 1), round(float(cy[i]), 1), p[4], [round(float(s), 2) for s in series[:, i]]])
    rows.sort(key=lambda r: -r[5][-1])
    rows = rows[:1500]
    j = int(np.argmax(total))
    my, mx = divmod(j, W)
    mlon, mlat = inverse((mx + 0.5) / SCALE, (my + 0.5) / SCALE)
    near = where(places, float(mlat), float(mlon))
    end = steps[-1]
    meta = {
        "kind": kind,
        "built": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "start": start.strftime("%Y-%m-%dT%H:%MZ"),
        "end": end.strftime("%Y-%m-%dT%H:%MZ"),
        "steps": [t.strftime("%Y-%m-%dT%H:%MZ") for t in steps],
        "scale": SCALE,
        "total": "total.webp",
        "codes": CODES[kind],
        "max": {
            "in": round(float(total.max()), 2),
            "x": round((mx + 0.5) / SCALE, 1),
            "y": round((my + 0.5) / SCALE, 1),
            "near": near,
        },
        "cities": rows,
        "reports": reports(kind, start, end),
        "source": (
            "NOAA MRMS multi-sensor precipitation (radar and gauges), Pass 2"
            if kind == "rain"
            else "NOAA NOHRSC National Snowfall Analysis"
        ),
    }
    with open(os.path.join(out, "meta.json"), "w") as f:
        json.dump(meta, f, separators=(",", ":"))
    size = sum(os.path.getsize(os.path.join(out, n)) for n in os.listdir(out))
    print(f"{kind}: {len(steps)} steps to {meta['end']}, {len(rows)} cities, {len(meta['reports'])} reports, {size / 1e6:.2f} MB")


if __name__ == "__main__":
    a = sys.argv[1:]
    main(a[0], a[a.index("--out") + 1] if "--out" in a else os.path.join("site", a[0]))
