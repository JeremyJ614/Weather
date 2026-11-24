"""
Publishes the daily data build (.github/workflows/data.yml) to this repository's `data` branch:
one fresh commit holding every product, then `latest.json` naming that commit, so browsers
fetch files pinned to it from jsDelivr (a cached file can never mix with a newer one). The
branch is replaced each day, so it never grows. A product that failed to build today keeps
yesterday's copy (taken from the branch as it stood), and nothing is pushed if every product
failed.

    python3 scripts/publish-data.py site prev
      site  today's build: site/tracks, site/rain, site/snow (any may be missing)
      prev  the data branch as it stood (an empty or missing folder on the first run)
"""

import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone

PRODUCTS = {
    # product: (file that proves it built, how latest.json sums it up)
    "tracks": ("storms.json", lambda m: {"built": m["built"], "storms": len(m["s"]["y"])}),
    "rain": ("meta.json", lambda m: {"built": m["built"], "end": m["end"]}),
    "snow": ("meta.json", lambda m: {"built": m["built"], "end": m["end"]}),
}


def run(*cmd, cwd):
    return subprocess.run(cmd, cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def main(site, prev):
    fresh = 0
    for name, (proof, _) in PRODUCTS.items():
        here = os.path.join(site, name)
        if os.path.exists(os.path.join(here, proof)):
            fresh += 1
            print(f"{name}: built today")
            continue
        old = os.path.join(prev, name)
        if os.path.exists(os.path.join(old, proof)):
            shutil.rmtree(here, ignore_errors=True)
            shutil.copytree(old, here)
            print(f"{name}: kept yesterday's copy")
        else:
            print(f"{name}: none")
    if not fresh:
        sys.exit("Nothing built today; the data branch stays as it was.")

    summary = {}
    for name, (proof, sum_up) in PRODUCTS.items():
        p = os.path.join(site, name, proof)
        if os.path.exists(p):
            summary[name] = sum_up(json.load(open(p)))

    shutil.rmtree(os.path.join(site, ".git"), ignore_errors=True)
    run("git", "init", "-q", "-b", "data", cwd=site)
    run("git", "config", "user.name", "github-actions[bot]", cwd=site)
    run("git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com", cwd=site)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    run("git", "add", "-A", cwd=site)
    run("git", "commit", "-qm", f"Daily data {stamp}", cwd=site)
    sha = run("git", "rev-parse", "HEAD", cwd=site)
    latest = {"sha": sha, "built": stamp, **summary}
    with open(os.path.join(site, "latest.json"), "w") as f:
        json.dump(latest, f, separators=(",", ":"))
    run("git", "add", "latest.json", cwd=site)
    run("git", "commit", "-qm", f"Point latest.json at {sha[:7]}", cwd=site)
    print(json.dumps(latest))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
