"""Combine the per-slot CSVs from scrape.py into ../combined_equipment.csv.

Cosmetic copies such as "Dragon boots (g)" or "Gilded platebody", whose stats
are identical to the plain item, are left out (see cosmetic.py).
"""

import csv
from pathlib import Path

from cosmetic import cosmetic_copies

OUTPUT_DIR = Path("../output")
COMBINED_FILE = Path("../combined_equipment.csv")
# Columns that are not compared when deciding whether an item is a cosmetic copy
NOT_STATS = {"image", "name", "is_member", "weight"}


def combine_csvs():
    csv_files = sorted(
        file
        for file in OUTPUT_DIR.glob("*.csv")
        if file.resolve() != COMBINED_FILE.resolve()
    )

    if not csv_files:
        print(f"No CSV files found in {OUTPUT_DIR}")
        return

    header = None
    rows: list[dict] = []

    for csv_file in csv_files:
        print(f"Reading {csv_file.name}...")

        with csv_file.open("r", newline="", encoding="utf-8-sig") as infile:
            reader = csv.DictReader(infile)

            if not reader.fieldnames:
                print(f"Skipping {csv_file.name}: no header found")
                continue

            if header is None:
                header = reader.fieldnames
            elif reader.fieldnames != header:
                print(f"Skipping {csv_file.name}: columns don't match")
                continue

            rows.extend(reader)

    if not rows or header is None:
        print("No rows were combined.")
        return

    cosmetic = cosmetic_copies(rows, [c for c in header if c not in NOT_STATS])
    for name in sorted(cosmetic):
        print(f"  Skipping cosmetic copy: {name} (same stats as {cosmetic[name]})")
    rows = [r for r in rows if r["name"] not in cosmetic]

    with COMBINED_FILE.open("w", newline="", encoding="utf-8-sig") as outfile:
        writer = csv.DictWriter(outfile, fieldnames=header)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nCombined {len(csv_files)} CSV files.")
    print(f"Total rows: {len(rows)} ({len(cosmetic)} cosmetic copies skipped)")
    print(f"Saved to: {COMBINED_FILE}")


if __name__ == "__main__":
    combine_csvs()
