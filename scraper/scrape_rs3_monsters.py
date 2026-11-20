"""Scrape RS3 monsters from runescape.wiki into ../rs3/monsters.csv.

One row per monster page (its most complete version). Dungeoneering monsters, familiars
and historical versions are skipped.
"""

import re
from collections import defaultdict

from rs3_common import load_release_years, release_year_for, write_csv
from wiki_bucket import RS3_WIKI, clean_text, page_images, query_bucket

COLUMNS = [
    "name",
    "image",
    "combat_level",
    "release_year",
    "size",
    "attack_style",
    "attack_speed",
    "weakness",
    "slayer_category",
    "league_region",
    "life_points",
    "examine",
]

FIELDS = [
    "page_name",
    "page_name_sub",
    "combat_level",
    "size",
    "examine",
    "league_region",
    "attack_style_text",
    "weakness_text",
    "slayer_category",
    "attack_rate",
    "life_points",
]

EXCLUDED_PAGE = re.compile(
    r"\((?:Dungeoneering|historical|.*, historical|familiar|summoned|monster|unused.*|beta)\)$", re.I
)
EXCLUDED_CATEGORIES = {"creatures of daemonheim"}

# Normalise the different spellings the wiki uses for weaknesses
WEAKNESS_ALIASES = {
    "arrow": "arrows",
    "bolt": "bolts",
    "crushing": "crush",
    "slashing": "slash",
    "stabbing": "stab",
}
NO_VALUE = {"", "none", "nothing", "na", "n/a", "no", "general"}
# League region values that are not actual regions
NOT_REGIONS = {"global", "disabled", "impossible", "new_varrock"}
REGION_TYPOS = {"Wildernes": "Wilderness"}


def title_list(values) -> list[str]:
    out: list[str] = []
    for value in values or []:
        value = clean_text(value).lower()
        value = WEAKNESS_ALIASES.get(value, value)
        if value not in NO_VALUE and value.capitalize() not in out:
            out.append(value.capitalize())
    return out


def regions(value) -> list[str]:
    found = set()
    for part in re.split(r"[,&]", clean_text(value)):
        part = part.strip()
        if part.lower() in NO_VALUE or part.lower() in NOT_REGIONS:
            continue
        part = part.capitalize()
        found.add(REGION_TYPOS.get(part, part))
    return sorted(found)


def main():
    print("Downloading RS3 monster data...")
    monsters = query_bucket("infobox_monster", FIELDS, RS3_WIKI)
    release = load_release_years()

    pages: dict[str, list[dict]] = defaultdict(list)
    for monster in monsters:
        page = monster["page_name"]
        categories = {c.lower() for c in monster.get("slayer_category") or []}
        if not monster.get("combat_level") or EXCLUDED_PAGE.search(page) or categories & EXCLUDED_CATEGORIES:
            continue
        pages[page].append(monster)

    # The monster bucket stores no images, so use each page's main image
    print("Downloading page images...")
    images = page_images(sorted(pages), RS3_WIKI)

    rows = []
    for page, versions in pages.items():
        # Pick the most complete version (some boss phases have no combat data)
        m = max(versions, key=lambda v: sum(1 for f in FIELDS if v.get(f)))
        speed = m.get("attack_rate")
        rows.append(
            {
                "name": page,
                "image": images.get(page, ""),
                "combat_level": m["combat_level"],
                "release_year": release_year_for(m["page_name_sub"], release),
                # The wiki leaves size empty for ordinary 1x1 monsters
                "size": m.get("size") or 1,
                "attack_style": ";".join(title_list(m.get("attack_style_text"))),
                "attack_speed": speed if isinstance(speed, int) and speed > 0 else "",
                "weakness": ";".join(title_list(m.get("weakness_text"))),
                "slayer_category": ";".join(title_list(m.get("slayer_category"))),
                "league_region": ";".join(regions(m.get("league_region"))),
                "life_points": m.get("life_points") or "",
                "examine": clean_text(m.get("examine")),
            }
        )

    write_csv("monsters.csv", COLUMNS, rows)


if __name__ == "__main__":
    main()
