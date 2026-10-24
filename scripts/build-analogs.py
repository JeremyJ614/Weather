#!/usr/bin/env python3
"""
Builds the Severe Analogs archive (Extras engine): every day from 2004 through the last year
SPC has finished, as a compact fingerprint of its weather over the Lower 48, with how many
severe reports it had.

  - NCEP/NCAR Reanalysis 1 daily means (NOAA PSL, public domain), 2.5°, 25–50°N, 125–65°W:
    500 mb height, 850 mb temperature, 850 and 500 mb winds, precipitable water and the best
    four-layer lifted index, read by OPeNDAP so only the U.S. box comes down.
  - SPC's severe weather database (tornadoes, 1" hail, 50 kt wind) for the daily counts.

Each field is standardized per grid point, weighted toward instability and moisture, and the
whole set compressed by principal components (K of them). Out:
  public/extras/analogs.bin   means, spreads, basis, each day's components, its counts
  src/lib/analogs/meta.json   what is where in the file

Run when SPC publishes a new year:  python3 scripts/build-analogs.py
"""
import csv, io, json, os, re, tempfile, time, urllib.error, urllib.request, zipfile
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
import numpy as np

UA = {"User-Agent": "StormSync Weather (https://weather.sswx.space)"}
DAP = "https://psl.noaa.gov/thredds/dodsC/Datasets/ncep.reanalysis.dailyavgs"
SPC = "https://www.spc.noaa.gov/wcm/data"
FIRST = 2004
LAT0, LAT1 = 16, 26  # 50°N .. 25°N
LON0, LON1 = 94, 118  # 235°E .. 295°E
K = 40
# (name, file, variable, level index or None, weight)
FIELDS = [
    ("z500", "pressure/hgt", "hgt", 5, 1.0),
    ("t850", "pressure/air", "air", 2, 0.75),
    ("u850", "pressure/uwnd", "uwnd", 2, 1.0),
    ("v850", "pressure/vwnd", "vwnd", 2, 1.0),
    ("u500", "pressure/uwnd", "uwnd", 5, 1.0),
    ("v500", "pressure/vwnd", "vwnd", 5, 1.0),
    ("pwat", "surface/pr_wtr.eatm", "pr_wtr", None, 1.5),
    ("li", "surface/lftx4.sfc", "lftx4", None, 1.5),
]


def get(url, binary=False):
    # PSL asks for patience under load (429): back off and try again.
    for n in range(7):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
                b = r.read()
            return b if binary else b.decode("latin-1")
        except urllib.error.HTTPError as e:
            if e.code not in (429, 502, 503) or n == 6:
                raise
            time.sleep(5 * 2**n)


def last_year():
    page = get("https://www.spc.noaa.gov/wcm/")
    return max(int(y) for y in re.findall(r"1950-(\d{4})_actual_tornadoes\.csv", page))


CACHE = os.path.join(tempfile.gettempdir(), "sswx-analogs")


def field(path, var, lev, year):
    """One field for one year over the U.S. box, kept on disk so a rerun skips it."""
    os.makedirs(CACHE, exist_ok=True)
    cached = os.path.join(CACHE, f"{var}-{lev}-{year}.npy")
    if os.path.exists(cached):
        return np.load(cached)
    box = f"[{LAT0}:1:{LAT1}][{LON0}:1:{LON1}]"
    n = 366 if year % 4 == 0 else 365
    q = f"{var}[0:1:{n - 1}]" + (f"[{lev}:1:{lev}]" if lev is not None else "") + box
    txt = get(f"{DAP}/{path}.{year}.nc.ascii?{q}")
    body = txt.split("---------------------------------------------", 1)[1]
    rows = [l for l in body.splitlines() if l.startswith("[")]
    vals = [float(x) for l in rows for x in l.split(",")[1:]]
    a = np.array(vals, dtype=np.float32).reshape(n, LAT1 - LAT0 + 1, LON1 - LON0 + 1)
    np.save(cached, a)
    return a


def counts(last):
    days = {}

    def add(d, k):
        days.setdefault(d, [0, 0])
        days[d][k] += 1

    t = csv.DictReader(io.StringIO(get(f"{SPC}/1950-{last}_actual_tornadoes.csv")))
    seen = set()
    for r in t:
        if int(r["yr"]) < FIRST:
            continue
        key = (r["yr"], r["om"])
        if key in seen:
            continue
        seen.add(key)
        add(r["date"], 0)
        add(r["date"], 1)
    for kind, low in (("hail", 1.0), ("wind", 50)):
        z = zipfile.ZipFile(io.BytesIO(get(f"{SPC}/1955-{last}_{kind}.csv.zip", True)))
        name = [n for n in z.namelist() if n.endswith(".csv")][0]
        for r in csv.DictReader(io.TextIOWrapper(z.open(name), "latin-1")):
            if int(r["yr"]) < FIRST:
                continue
            try:
                m = float(r["mag"])
            except ValueError:
                m = 0
            # Wind damage reports carry no speed (0): they count as severe too.
            if (kind == "hail" and m >= low) or (kind == "wind" and (m >= low or m == 0)):
                add(r["date"], 0)
    return days


def main():
    last = last_year()
    years = list(range(FIRST, last + 1))
    print("years", years[0], "-", years[-1])
    stacks = []
    with ThreadPoolExecutor(3) as pool:
        for name, path, var, lev, w in FIELDS:
            parts = list(pool.map(lambda y: field(path, var, lev, y), years))
            stacks.append(np.concatenate(parts))
            print(name, "done", stacks[-1].shape, flush=True)
    n = stacks[0].shape[0]
    X = np.concatenate([s.reshape(n, -1) for s in stacks], axis=1).astype(np.float64)
    weights = np.concatenate(
        [np.full(stacks[i][0].size, f[4]) for i, f in enumerate(FIELDS)]
    )
    mean = X.mean(axis=0)
    std = X.std(axis=0) + 1e-6
    Z = (X - mean) / std * weights
    U, S, Vt = np.linalg.svd(Z, full_matrices=False)
    basis = Vt[:K]
    pcs = Z @ basis.T
    var = (S[:K] ** 2).sum() / (S**2).sum()
    print("explained variance", round(float(var), 3))
    scale = np.abs(pcs).max(axis=0) / 32000
    q = np.round(pcs / scale).astype(np.int16)
    c = counts(last)
    start = date(FIRST, 1, 1)
    tally = np.zeros((n, 2), dtype=np.uint16)
    for i in range(n):
        v = c.get((start + timedelta(days=i)).isoformat())
        if v:
            tally[i] = [min(v[0], 65535), min(v[1], 65535)]
    F = X.shape[1]
    out = open("public/extras/analogs.bin", "wb")
    for arr in (mean.astype("<f4"), std.astype("<f4"), (weights).astype("<f4"),
                basis.astype("<f4"), scale.astype("<f4")):
        out.write(arr.tobytes())
    out.write(q.astype("<i2").tobytes())
    out.write(tally.astype("<u2").tobytes())
    out.close()
    meta = {
        "start": start.isoformat(),
        "days": n,
        "k": K,
        "f": F,
        "lats": [50 - 2.5 * j for j in range(LAT1 - LAT0 + 1)],
        "lons": [-125 + 2.5 * i for i in range(LON1 - LON0 + 1)],
        "fields": [f[0] for f in FIELDS],
        "explained": round(float(var), 3),
        "through": last,
    }
    json.dump(meta, open("src/lib/analogs/meta.json", "w"), indent=2)
    print("wrote", n, "days,", F, "features,", K, "components")


if __name__ == "__main__":
    main()
