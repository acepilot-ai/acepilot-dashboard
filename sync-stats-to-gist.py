#!/usr/bin/env python3
"""
Sync JSONL stats from VPS to GitHub Gist for dashboard stats API.
Run as cron job: */5 * * * * /path/to/sync-stats-to-gist.py

This enables the dashboard chat to access real-time stats from the VPS.
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Configuration
SUBMISSIONS_PATH = os.getenv('SUBMISSIONS_PATH', '')
REPLIES_PATH = os.getenv('REPLIES_PATH', '')
STEPHIE_PATH = os.getenv('STEPHIE_PATH', '')
GIST_ID = os.getenv('STATS_GIST_ID', '')
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN', '')

# If using requests library (pip install requests)
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


def classify_outcome(outcome: str) -> str:
    """Classify submission outcome."""
    if outcome == "submitted":
        return "form"
    if "email_sent" in outcome:
        return "email"
    if outcome in ["no_website", "captcha", "no_form"]:
        return "skip"
    if outcome.startswith("error:"):
        return "error"
    return "skip"


def read_jsonl(filepath: str) -> list:
    """Read JSONL file."""
    if not filepath or not os.path.exists(filepath):
        return []
    try:
        rows = []
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return rows
    except Exception as e:
        print(f"Error reading {filepath}: {e}", file=sys.stderr)
        return []


def get_today() -> str:
    """Get today's date in YYYY-MM-DD format."""
    return datetime.now().strftime('%Y-%m-%d')


def aggregate_stats() -> dict:
    """Aggregate stats from JSONL files."""
    today = get_today()

    # Read data
    submissions = read_jsonl(SUBMISSIONS_PATH)
    replies = read_jsonl(REPLIES_PATH)
    stephie_rows = read_jsonl(STEPHIE_PATH)

    # PDS stats
    pds = {
        "total": 0,
        "today": 0,
        "by_outcome": {"form": 0, "email": 0, "skip": 0, "error": 0},
        "today_by_outcome": {"form": 0, "email": 0, "skip": 0, "error": 0},
        "by_sender": {}
    }

    for row in submissions:
        if not row.get('outcome'):
            continue

        cls = classify_outcome(row['outcome'])
        row_date = (row.get('ts') or row.get('timestamp') or '')[:10]
        sender = row.get('sender') or 'unknown'

        pds['total'] += 1
        pds['by_outcome'][cls] = pds['by_outcome'].get(cls, 0) + 1

        if row_date == today:
            pds['today'] += 1
            pds['today_by_outcome'][cls] = pds['today_by_outcome'].get(cls, 0) + 1

        # By sender
        if sender not in pds['by_sender']:
            pds['by_sender'][sender] = {"total": 0, "today": 0, "form": 0, "email": 0}

        pds['by_sender'][sender]['total'] += 1
        if cls == "form":
            pds['by_sender'][sender]['form'] += 1
        elif cls == "email":
            pds['by_sender'][sender]['email'] += 1

        if row_date == today:
            pds['by_sender'][sender]['today'] += 1

    # Stephie stats
    stephie = {
        "total": 0,
        "today": 0,
        "by_outcome": {"form": 0, "email": 0, "skip": 0, "error": 0},
        "today_by_outcome": {"form": 0, "email": 0, "skip": 0, "error": 0}
    }

    for row in stephie_rows:
        if not row.get('outcome'):
            continue

        cls = classify_outcome(row['outcome'])
        row_date = (row.get('ts') or row.get('timestamp') or '')[:10]

        stephie['total'] += 1
        stephie['by_outcome'][cls] = stephie['by_outcome'].get(cls, 0) + 1

        if row_date == today:
            stephie['today'] += 1
            stephie['today_by_outcome'][cls] = stephie['today_by_outcome'].get(cls, 0) + 1

    # Replies stats
    replies_data = {
        "total": len(replies),
        "by_classification": {}
    }
    for r in replies:
        cls = r.get('classification') or 'unknown'
        replies_data['by_classification'][cls] = replies_data['by_classification'].get(cls, 0) + 1

    return {
        "generated_at": datetime.now().isoformat() + 'Z',
        "pds": pds,
        "stephie": stephie,
        "replies": replies_data,
        "activity": [],
        "agents": {},
        "campaigns": []
    }


def push_to_gist(stats: dict) -> bool:
    """Push stats to GitHub Gist."""
    if not GIST_ID or not GITHUB_TOKEN:
        print("Error: STATS_GIST_ID or GITHUB_TOKEN not set", file=sys.stderr)
        return False

    if not HAS_REQUESTS:
        print("Error: requests library required (pip install requests)", file=sys.stderr)
        return False

    try:
        url = f"https://api.github.com/gists/{GIST_ID}"
        headers = {
            "Authorization": f"token {GITHUB_TOKEN}",
            "Content-Type": "application/json"
        }
        payload = {
            "files": {
                "stats_cache.json": {
                    "content": json.dumps(stats, indent=2)
                }
            }
        }

        response = requests.patch(url, json=payload, headers=headers, timeout=10)

        if response.status_code == 200:
            print(f"✓ Synced stats to Gist at {stats['generated_at']}")
            return True
        else:
            print(f"Error: Gist update failed ({response.status_code})", file=sys.stderr)
            return False

    except Exception as e:
        print(f"Error pushing to Gist: {e}", file=sys.stderr)
        return False


def main():
    """Main sync function."""
    # Check config
    if not SUBMISSIONS_PATH or not STEPHIE_PATH:
        print("Error: SUBMISSIONS_PATH and STEPHIE_PATH required", file=sys.stderr)
        sys.exit(1)

    if not GIST_ID or not GITHUB_TOKEN:
        print("Error: STATS_GIST_ID and GITHUB_TOKEN required", file=sys.stderr)
        sys.exit(1)

    # Aggregate stats
    stats = aggregate_stats()

    # Push to Gist
    if push_to_gist(stats):
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == '__main__':
    main()
