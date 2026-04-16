#!/usr/bin/env python3
"""Seed a local Graylog instance with synthetic TikTok Shop scrape data.

Posts GELF HTTP messages that look just like what the bookmarklet sends, so
the TokScrape mobile dashboard has something to render for each scaffolded
member (see mobile-app/www/js/users.js for the roster).

For each member it generates N consecutive daily "scrapes", each containing:
  - 5 metrics   (Affiliate GMV, Items sold, Est. commissions, Direct GMV, Videos)
  - K videos    (deterministic per member; metrics drift from one day to the next)

Usage
-----
    # Defaults: hit http://localhost:12202/gelf, 14 days of history per member
    python3 scripts/seed-graylog.py

    # Point at a remote Graylog:
    python3 scripts/seed-graylog.py --endpoint http://graylog.example:12202/gelf

    # Custom range:
    python3 scripts/seed-graylog.py --days 30 --videos 15

    # Only seed one member (creator handle, with leading @):
    python3 scripts/seed-graylog.py --creator @wizardofdealz

Requires:
    - A running Graylog with a GELF HTTP input on the given port.
    - Nothing else; uses stdlib only.

The script is idempotent in effect (re-running appends a fresh 14 days of
scrapes, but the bookmarklet's upsert-by-Video-ID logic lives in Apps Script,
not Graylog — Graylog stores every message). To start clean, delete the
Graylog stream index and re-run:
    docker compose exec graylog /usr/share/graylog/bin/graylog-ctl reindex
or just `docker compose down -v` for a full wipe.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import random
import sys
import time
import urllib.request
import urllib.error

# Kept in sync with mobile-app/www/js/users.js (the members list). Adding or
# removing a creator here just changes what the dashboard will have data for.
MEMBERS = [
    # (creator, display name, niche)
    ("@wizardofdealz",    "Wizard of Dealz",    "deals"),
    ("@beautybybri",      "Beauty by Bri",      "beauty"),
    ("@techguruak",       "Tech Guru AK",       "tech"),
    ("@fitnesswithmia",   "Fitness with Mia",   "fitness"),
    ("@cookingwithkenji", "Cooking with Kenji", "cooking"),
]

# Niche-appropriate video name fragments. The seeder draws from these so each
# member's video titles feel plausible, not just "Video 1 / Video 2".
NICHE_FRAGMENTS = {
    "deals": [
        "Massive Flash Deal", "Price Drop Alert", "Under $20 Finds",
        "Hidden Gems on Sale", "Best Bang for Your Buck", "Clearance Haul",
        "Stacking Coupons", "Prime Deal of the Day", "Seasonal Blowout",
    ],
    "beauty": [
        "Glass Skin Routine", "5-Minute Makeup", "Drugstore Dupes",
        "Acne-Safe Foundation", "Cool-Toned Everyday Look", "Lip Combo of the Week",
        "Viral Mascara Test", "Skin Barrier SOS", "TikTok Made Me Buy It",
    ],
    "tech": [
        "iPhone 17 First Look", "Budget Android Beats Flagships", "Mechanical Keyboard Tour",
        "Desk Setup Upgrade", "This Cable Changed My Life", "Best Power Banks Tested",
        "Smart Home Starter Kit", "USB-C Hub Shootout", "Monitor Calibration 101",
    ],
    "fitness": [
        "10-Minute Ab Burn", "Protein Bar Taste Test", "Leg Day Finisher",
        "Mobility Routine", "Pre-Workout Tier List", "Cutting Season Grocery Haul",
        "Posture Fix in 60s", "Home Gym Must-Haves", "Recovery Stack",
    ],
    "cooking": [
        "One-Pan Weeknight Dinner", "Better Than Takeout", "Viral Ramen Upgrade",
        "Meal Prep for Gains", "5-Ingredient Dessert", "Sheet-Pan Miracle",
        "Air Fryer Crispy Tofu", "Dumpling Night", "Sauce of the Month",
    ],
}

# Starting metric values per niche. Each subsequent day jitters up or down a
# little so the time-series charts actually look like time-series.
NICHE_BASELINES = {
    "deals":   {"gmv": 43000, "items": 1500, "views": 420000, "rpm": 55.0},
    "beauty":  {"gmv": 18500, "items":  640, "views": 210000, "rpm": 46.0},
    "tech":    {"gmv": 27000, "items":  190, "views": 155000, "rpm": 68.0},
    "fitness": {"gmv": 12000, "items":  410, "views": 320000, "rpm": 28.0},
    "cooking": {"gmv":  8900, "items":  260, "views": 180000, "rpm": 22.0},
}

HOST_LABEL = "tiktok-bookmarklet"


def daterange(days: int, end: dt.datetime | None = None):
    """Yields `days` timestamps, oldest first, one per day, ending at `end`."""
    if end is None:
        end = dt.datetime.utcnow().replace(hour=15, minute=22, second=0, microsecond=0)
    for i in range(days - 1, -1, -1):
        yield end - dt.timedelta(days=i)


def pct_change(rng: random.Random) -> str:
    up = rng.random() > 0.25
    arrow = "\u2191" if up else "\u2193"   # ↑ / ↓
    return f"{arrow} {rng.uniform(0.5, 48.0):.2f}%"


def money(n: float) -> str:
    return f"${n:,.2f}"


def count(n: int) -> str:
    return f"{n:,}"


def make_videos(rng: random.Random, creator: str, niche: str, count_per_day: int, day_idx: int) -> list[dict]:
    frags = NICHE_FRAGMENTS[niche]
    base = NICHE_BASELINES[niche]
    videos = []
    # Use a deterministic seed per (creator, day_idx) so Top-N charts are
    # stable across re-renders but still differ day to day.
    for i in range(count_per_day):
        # Use epoch millis for a unique-ish 19-digit id (matches TikTok's
        # snowflake shape well enough for demo purposes).
        vid_id = str(7_600_000_000_000_000_000 + day_idx * 10_000_000 + i * 1_000 + rng.randint(0, 999))
        title = f"{rng.choice(frags)} #{rng.choice(['tiktokshop','fyp','foryou','viral','amazonfinds'])}"

        # Views are power-law-ish: a couple of bangers, lots of long tail.
        view_scale = (1.0 / (i + 1)) ** 0.85
        views = int(base["views"] * view_scale * rng.uniform(0.4, 1.6))
        items_sold = max(1, int(base["items"] * view_scale * rng.uniform(0.2, 1.3) / 6))
        aff_gmv = round(items_sold * rng.uniform(3.5, 18.0), 2)
        direct_gmv = round(aff_gmv * rng.uniform(0.6, 1.2), 2)
        commissions = round(aff_gmv * rng.uniform(0.10, 0.22), 2)
        rpm = round(aff_gmv / max(1, views) * 1000, 2)
        completion_rate = f"{rng.uniform(30, 82):.2f}%"

        posted = (dt.datetime.utcnow() - dt.timedelta(days=rng.randint(1, 60))).strftime("%Y/%m/%d")
        duration = f"0min{rng.randint(12, 59)}s"

        link = f"https://www.tiktok.com/{creator}/video/{vid_id}"
        details = (
            f"https://partner.us.tiktokshop.com/compass/video-analysis/detail/{vid_id}"
            f"?creator_id=6983923605470856197"
        )

        videos.append({
            "Video ID":         vid_id,
            "Name":             title,
            "Link":             link,
            "Posted":           posted,
            "Duration":         duration,
            "Affiliate GMV":    money(aff_gmv),
            "Items sold":       count(items_sold),
            "Est. commissions": money(commissions),
            "Direct GMV":       money(direct_gmv),
            "RPM":              money(rpm),
            "Views":            count(views),
            "Completion rate":  completion_rate,
            "Details":          details,
        })
    return videos


def make_metrics(rng: random.Random, niche: str, day_idx: int, total_videos: int) -> tuple[list[dict], dict]:
    base = NICHE_BASELINES[niche]
    # Day-to-day drift: multiplicative walk with mean ~1.0.
    drift = 1.0 + math.sin(day_idx / 4.0) * 0.08 + rng.uniform(-0.06, 0.08)
    gmv         = base["gmv"]   * drift * rng.uniform(0.88, 1.14)
    items       = base["items"] * drift * rng.uniform(0.85, 1.20)
    commissions = gmv * rng.uniform(0.13, 0.18)
    direct_gmv  = gmv * rng.uniform(0.65, 0.95)
    videos_total = int(total_videos + rng.randint(0, 3))

    metrics = [
        {"name": "Affiliate GMV",    "value": money(gmv),          "trend": pct_change(rng)},
        {"name": "Items sold",       "value": count(int(items)),   "trend": pct_change(rng)},
        {"name": "Est. commissions", "value": money(commissions),  "trend": pct_change(rng)},
        {"name": "Direct GMV",       "value": money(direct_gmv),   "trend": pct_change(rng)},
        {"name": "Videos",           "value": count(videos_total), "trend": pct_change(rng)},
    ]
    summary = {
        "gmv": gmv, "items": items, "commissions": commissions,
        "direct_gmv": direct_gmv, "videos_total": videos_total,
    }
    return metrics, summary


def gelf_payload(creator: str, scraped_at: dt.datetime, metrics: list[dict], videos: list[dict], date_start: str, date_end: str) -> dict:
    return {
        "version":        "1.1",
        "host":           HOST_LABEL,
        "short_message":  f"tiktok scrape: {creator} ({len(videos)} videos)",
        "timestamp":      int(scraped_at.timestamp()),
        "_creator":       creator,
        "_scrapedAt":     scraped_at.isoformat(timespec="milliseconds") + "Z",
        "_date_start":    date_start,
        "_date_end":      date_end,
        "_metrics_count": len(metrics),
        "_videos_count":  len(videos),
        "_metrics_json":  json.dumps(metrics, ensure_ascii=False),
        "_videos_json":   json.dumps(videos,  ensure_ascii=False),
    }


def post(endpoint: str, payload: dict, timeout: float = 5.0) -> int:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--endpoint", default="http://localhost:12202/gelf",
                    help="Graylog GELF HTTP endpoint (default: %(default)s)")
    ap.add_argument("--days", type=int, default=14,
                    help="Days of history to seed per member (default: %(default)s)")
    ap.add_argument("--videos", type=int, default=12,
                    help="Videos per daily scrape (default: %(default)s)")
    ap.add_argument("--creator", default=None,
                    help="Only seed this creator handle (e.g. @wizardofdealz). "
                         "Default: seed every member.")
    ap.add_argument("--seed", type=int, default=42,
                    help="Random seed for reproducibility (default: %(default)s)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Don't POST, just print one sample payload and exit.")
    args = ap.parse_args()

    members = [m for m in MEMBERS if args.creator is None or m[0] == args.creator]
    if not members:
        print(f"No member matches --creator {args.creator!r}", file=sys.stderr)
        return 2

    total_sent = 0
    total_failed = 0
    for creator, name, niche in members:
        rng = random.Random(f"{args.seed}:{creator}")
        print(f"--- Seeding {creator} ({name}, {niche}) ---")
        for day_idx, scraped_at in enumerate(daterange(args.days)):
            day_rng = random.Random(f"{args.seed}:{creator}:{day_idx}")
            videos = make_videos(day_rng, creator, niche, args.videos, day_idx)
            metrics, _summary = make_metrics(day_rng, niche, day_idx, len(videos))
            # The bookmarklet's "date range" is the month picker values: emulate
            # by using this scrape's month as start/end.
            ds = scraped_at.replace(day=1).strftime("%Y-%m-%d")
            de = scraped_at.strftime("%Y-%m-%d")
            payload = gelf_payload(creator, scraped_at, metrics, videos, ds, de)

            if args.dry_run:
                print(json.dumps(payload, indent=2))
                return 0

            try:
                status = post(args.endpoint, payload)
                total_sent += 1
                ok = 200 <= status < 300
                flag = "OK" if ok else f"HTTP {status}"
                if not ok:
                    total_failed += 1
                print(f"  [{flag}] {scraped_at.date()}  videos={len(videos)}  gmv={metrics[0]['value']}")
            except urllib.error.URLError as e:
                total_failed += 1
                print(f"  [FAIL] {scraped_at.date()}  {e}", file=sys.stderr)
            # Tiny pause so we don't overwhelm Graylog on weak dev machines.
            time.sleep(0.03)

    print(f"\nDone: {total_sent} sent ({total_failed} failed) across {len(members)} members.")
    if total_failed == 0 and total_sent > 0:
        print("Open the TokScrape app (or Graylog search for host:tiktok-bookmarklet) to see the data.")
    return 0 if total_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
