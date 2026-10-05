#!/usr/bin/env python3
"""Store GitHub release asset download counts as a dated JSON snapshot.

Usage: gh api --paginate 'repos/julianhille/MuhammaraJS/releases?per_page=100' \
         | python3 stats/downloads/snapshot.py [taken_at]
"""
import datetime
import json
import os
import sys


def compact(releases, taken_at):
    return {
        "taken_at": taken_at,
        "source": "github-release-assets",
        "releases": {
            r["tag_name"]: {
                "published_at": r["published_at"],
                "assets": {a["name"]: a["download_count"] for a in r["assets"]},
            }
            for r in releases
        },
    }


def main():
    raw = sys.stdin.read()
    # gh --paginate concatenates one JSON array per page
    releases, dec, i = [], json.JSONDecoder(), 0
    while i < len(raw):
        if raw[i].isspace():
            i += 1
            continue
        page, i = dec.raw_decode(raw, i)
        releases.extend(page)
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    taken_at = sys.argv[1] if len(sys.argv) > 1 else now
    out = os.path.join(os.path.dirname(__file__), taken_at[:10] + ".json")
    with open(out, "w") as f:
        json.dump(compact(releases, taken_at), f, indent=1, sort_keys=True)
        f.write("\n")
    print(out)


if __name__ == "__main__":
    main()
