"""Scrape examine texts for every item in ../combined_equipment.csv into ../item_examines.csv.

Run this after combine_csv.py so the item list is up to date.
"""

import csv
from pathlib import Path

from wiki_bucket import clean_text, query_bucket

EQUIPMENT_FILE = Path("../combined_equipment.csv")
OUTPUT_FILE = Path("../item_examines.csv")


def main():
    with EQUIPMENT_FILE.open(newline="", encoding="utf-8-sig") as file:
        names = list(dict.fromkeys(row["name"] for row in csv.DictReader(file)))

    print("Downloading item examines...")
    items = query_bucket("infobox_item", ["page_name", "page_name_sub", "examine"])

    by_version: dict[str, str] = {}
    by_page: dict[str, str] = {}
    for item in items:
        examine = clean_text(item.get("examine"))
        if not examine:
            continue
        by_version.setdefault(item.get("page_name_sub", ""), examine)
        by_page.setdefault(item.get("page_name", ""), examine)

    rows = []
    missing = []
    for name in names:
        examine = by_version.get(name) or by_page.get(name.split("#", 1)[0])
        if examine:
            rows.append({"name": name, "examine": examine})
        else:
            missing.append(name)

    with OUTPUT_FILE.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=["name", "examine"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Exported {len(rows)} examines -> {OUTPUT_FILE}")
    if missing:
        print(f"No examine found for {len(missing)} items: {', '.join(missing[:20])}...")


if __name__ == "__main__":
    main()
