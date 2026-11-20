"""Scrape monster data from the OSRS Wiki into ../monsters.csv.

One row per monster page. When a page has several versions (e.g. different
locations), the wiki's default version is used, falling back to the first one.
"""

import csv
import re
from collections import defaultdict
from pathlib import Path

from wiki_bucket import clean_text, file_url, query_bucket, release_year

OUTPUT_FILE = Path("../monsters.csv")

FIELDS = [
    "page_name",
    "default_version",
    "combat_level",
    "size",
    "attack_style",
    "attack_speed",
    "release_date",
    "examine",
    "slayer_category",
    "elemental_weakness",
    "image",
]

COLUMNS = [
    "name",
    "image",
    "combat_level",
    "release_year",
    "size",
    "attack_style",
    "attack_speed",
    "elemental_weakness",
    "slayer_category",
    "examine",
]

# Minigame copies, unreleased content and other non-standard variants.
EXCLUDED_PAGE = re.compile(
    r"\((?:Nightmare Zone|Deadman.*|PvM Arena|Echo|Construction|unused.*|historical"
    r"|Sailing alpha|Leagues.*|beta|Last Man Standing|Emir's Arena)\)$",
    re.IGNORECASE,
)

# Attack style keywords, in display order. Variants such as "Magical melee",
# "Typeless Crush" or "Slash (100% prayer penetration)" are reduced to these.
ATTACK_STYLES = [
    ("Stab", r"\bstab"),
    ("Slash", r"\bslash"),
    ("Crush", r"\bcrush"),
    ("Melee", r"\bmelee"),
    ("Ranged", r"\branged?\b"),
    ("Magic", r"\bmagic"),
    ("Dragonfire", r"dragonfire|icy breath"),
    ("Typeless", r"typeless"),
]


def normalize_styles(raw) -> list[str]:
    text = " ".join(raw or []).lower()
    return [name for name, pattern in ATTACK_STYLES if re.search(pattern, text)]


def normalize_categories(raw) -> list[str]:
    seen: list[str] = []
    for category in raw or []:
        category = clean_text(category)
        if category and category.lower() not in ("none", "n/a") and category not in seen:
            seen.append(category)
    return seen


def to_row(monster: dict) -> dict:
    weakness = clean_text(monster.get("elemental_weakness")).capitalize()
    speed = monster.get("attack_speed")
    images = monster.get("image") or []
    return {
        "name": monster["page_name"],
        "image": file_url(images[0]) if images else "",
        "combat_level": monster["combat_level"],
        "release_year": release_year(monster.get("release_date", "")),
        "size": monster.get("size") or "",
        "attack_style": ";".join(normalize_styles(monster.get("attack_style"))),
        "attack_speed": speed if isinstance(speed, int) and speed > 0 else "",
        "elemental_weakness": "" if weakness in ("", "None") else weakness,
        "slayer_category": ";".join(normalize_categories(monster.get("slayer_category"))),
        "examine": clean_text(monster.get("examine")),
    }


def main():
    print("Downloading monster data...")
    monsters = query_bucket("infobox_monster", FIELDS)

    pages: dict[str, list[dict]] = defaultdict(list)
    for monster in monsters:
        name = monster.get("page_name", "")
        if not monster.get("combat_level") or EXCLUDED_PAGE.search(name):
            continue
        pages[name].append(monster)

    rows = []
    for name, versions in pages.items():
        default = next((v for v in versions if "default_version" in v), versions[0])
        rows.append(to_row(default))
    rows.sort(key=lambda r: r["name"].lower())

    with OUTPUT_FILE.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Exported {len(rows)} monsters -> {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
