"""Shared helpers for the RS3 scrapers (data from runescape.wiki)."""

import csv
from pathlib import Path

from wiki_bucket import RS3_WIKI, query_bucket

OUTPUT_DIR = Path("../rs3")


def load_release_years() -> tuple[dict[str, int], dict[str, int]]:
    """Release year per page version (page_name_sub) and per page (earliest version)."""
    print("Downloading RS3 release dates...")
    by_version: dict[str, int] = {}
    by_page: dict[str, int] = {}
    for row in query_bucket("release_date", ["page_name", "page_name_sub", "year"], RS3_WIKI):
        year = row.get("year")
        if not year:
            continue
        by_version.setdefault(row["page_name_sub"], year)
        page = row["page_name"]
        by_page[page] = min(year, by_page.get(page, year))
    return by_version, by_page


def release_year_for(page_sub: str, release: tuple[dict[str, int], dict[str, int]]) -> str:
    by_version, by_page = release
    year = by_version.get(page_sub) or by_page.get(page_sub.split("#", 1)[0])
    return str(year) if year else ""


def write_csv(name: str, columns: list[str], rows: list[dict]):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / name
    rows.sort(key=lambda r: r["name"].lower())
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Exported {len(rows)} rows -> {path}")
