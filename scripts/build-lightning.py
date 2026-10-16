#!/usr/bin/env python3
"""
Builds src/lib/climo/lightning.json: NASA's combined LIS/OTD flash-rate climatology
(1995–2014, flashes/km²/year), which covers the whole country (OTD reached 75°), read
from GIBS tiles over the Lower 48 and averaged onto a 0.5° grid.

Run once (the record is closed):  python3 scripts/build-lightning.py
"""
import io, json, math, re, urllib.request
from PIL import Image

LAYER = "LIS_High_Resolution_Full_Climatology_Combined_Flash_Rate_Climatology"
GIBS = "https://gibs.earthdata.nasa.gov"
UA = {"User-Agent": "StormSync Weather (https://weather.sswx.space)"}
Z = 6
lat0, lon0, step, w, h = 24.0, -125.0, 0.5, 118, 52


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


cm = {}
for rgb, a, b in re.findall(
    r'rgb="([\d,]+)"[^>]*?value="\[([\d.]+),([\d.+INF]+)\)', get(f"{GIBS}/colormaps/v1.3/{LAYER}.xml").decode()
):
    cm[tuple(map(int, rgb.split(",")))] = float(a) if "INF" in b else (float(a) + float(b)) / 2


def value(rgb):
    if rgb in cm:
        return cm[rgb]
    return min(cm.items(), key=lambda kv: sum((x - y) ** 2 for x, y in zip(kv[0], rgb)))[1]


def tile_xy(lat, lon):
    n = 2**Z
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y


sums, counts = [0.0] * (w * h), [0] * (w * h)
x0, y1 = tile_xy(lat0, lon0)
x1, y0 = tile_xy(lat0 + h * step, lon0 + w * step)
for ty in range(int(y0), int(y1) + 1):
    for tx in range(int(x0), int(x1) + 1):
        url = f"{GIBS}/wmts/epsg3857/best/{LAYER}/default/1995-05-04/GoogleMapsCompatible_Level6/{Z}/{ty}/{tx}.png"
        img = Image.open(io.BytesIO(get(url))).convert("RGBA")
        px = img.load()
        for py in range(256):
            yf = (ty + (py + 0.5) / 256) / 2**Z
            lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * yf))))
            i = int((lat - lat0) / step)
            if not 0 <= i < h:
                continue
            for pxx in range(256):
                lon = (tx + (pxx + 0.5) / 256) / 2**Z * 360 - 180
                j = int((lon - lon0) / step)
                if not 0 <= j < w:
                    continue
                r, g, b, a = px[pxx, py]
                v = 0.0 if a == 0 or (r, g, b) == (0, 0, 0) else value((r, g, b))
                sums[i * w + j] += v
                counts[i * w + j] += 1
        print("tile", tx, ty)

grid = [round(s / c * 10) if c else 0 for s, c in zip(sums, counts)]
with open("src/lib/climo/lightning.json", "w") as f:
    json.dump({"first": 1995, "last": 2014, "lat0": lat0, "lon0": lon0, "step": step, "w": w, "h": h, "x10": grid}, f, separators=(",", ":"))
print("max", max(grid) / 10)
