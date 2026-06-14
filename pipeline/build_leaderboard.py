#!/usr/bin/env python3
"""Build data/leaderboard.json from submissions/ + the curated overlay.

v1 (agreed scope): the served board in data/leaderboard.json is a curated
snapshot — it includes the air-quality + stock-quant tracks, whose original
raw inputs are no longer available, so they are kept as curated rows.

This script currently:
  1. validates every submission against the TSF-Core contract, and
  2. leaves data/leaderboard.json (the curated board) in place.

The forward path (a later version) will aggregate submissions/ into the
regression tracks and merge curated/ for the rest, replacing curated rows as
real submissions arrive. Until then we keep the board curated to avoid
regressing tracks that have no bundles yet.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    rc = subprocess.call([sys.executable, str(ROOT / "pipeline" / "validate.py")])
    if rc != 0:
        print("❌ submission validation failed — not updating the board.")
        return rc
    board = ROOT / "data" / "leaderboard.json"
    print(f"\nℹ️  board kept as the curated snapshot: {board.relative_to(ROOT)}")
    print("   (submission-driven regeneration is a forward step — see this file's docstring)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
