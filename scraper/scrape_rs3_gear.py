"""Scrape RS3 equipment from runescape.wiki into ../rs3/equipment.csv.

One row per item page (charged/unbound/degraded versions collapse to the
first version). Cosmetic recolours (the wiki's own flag, plus trimmed/gilded/
coloured copies with the same stats as the plain item, see cosmetic.py),
"Lucky" copies, items with no stats and the Dungeoneering class/tier copies
are skipped.
"""

import re
from collections import defaultdict

from cosmetic import cosmetic_copies
from rs3_common import load_release_years, release_year_for, write_csv
from wiki_bucket import RS3_WIKI, clean_text, file_url, query_bucket

COLUMNS = [
    "name",
    "image",
    "equipment_slot",
    "combat_class",
    "tier",
    "armour_type",
    "damage",
    "accuracy",
    "attack_style",
    "attack_speed",
    "armour",
    "life_points",
    "damage_bonus",
    "prayer",
    "is_member",
    "release_year",
    "examine",
]

BONUS_FIELDS = [
    "page_name",
    "page_name_sub",
    "combat_class",
    "equipment_slot",
    "equipment_type",
    "weapon_damage",
    "weapon_accuracy",
    "attack_style",
    "equipment_armour",
    "equipment_life_points",
    "weapon_attack_speed",
    "prayer_bonus",
    "strength_bonus",
    "ranged_bonus",
    "magic_bonus",
    "necromancy_bonus",
    "equipment_tier",
    "is_cosmetic_recolour",
]

EXCLUDED_PAGE = re.compile(r"\((?:class \d|h\d|tier \d+|Dungeoneering|b|broken)\)$", re.I)

# Older items list their speed as a word; these are the equivalent tick counts.
SPEED_WORDS = {"fastest": 4, "fast": 5, "average": 6, "slow": 7, "slowest": 8}

SLOTS = {
    "main hand weapon": "main hand",
    "off-hand weapon": "off-hand",
    "2h weapon": "two-handed",
}


def number(value) -> str:
    try:
        n = float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return ""
    return str(int(n)) if n == int(n) else f"{n:g}"


STAT_FIELDS = [
    "weapon_damage",
    "weapon_accuracy",
    "equipment_armour",
    "equipment_life_points",
    "prayer_bonus",
    "strength_bonus",
    "ranged_bonus",
    "magic_bonus",
    "necromancy_bonus",
]


def has_stats(row: dict) -> bool:
    """Tiered gear, or untiered gear (e.g. jewellery) with at least one real bonus."""
    if row.get("equipment_tier"):
        return True
    return any(float(number(row.get(k)) or 0) != 0 for k in STAT_FIELDS)


def attack_speed(value) -> str:
    text = str(value or "").strip().lower()
    if text.isdigit():
        return text
    return str(SPEED_WORDS.get(text, ""))


def main():
    print("Downloading RS3 equipment bonuses...")
    bonuses = query_bucket("infobox_bonuses", BONUS_FIELDS, RS3_WIKI)
    print("Downloading RS3 item infoboxes...")
    items = query_bucket(
        "infobox_item", ["page_name", "page_name_sub", "image", "examine", "is_members_only"], RS3_WIKI
    )
    release = load_release_years()

    item_by_version = {i["page_name_sub"]: i for i in items}
    item_by_page: dict[str, dict] = {}
    for item in items:
        item_by_page.setdefault(item["page_name"], item)

    pages: dict[str, list[dict]] = defaultdict(list)
    for row in bonuses:
        page = row["page_name"]
        if (
            not has_stats(row)
            or "is_cosmetic_recolour" in row
            or page.startswith("Lucky ")
            or EXCLUDED_PAGE.search(page)
        ):
            continue
        pages[page].append(row)

    rows = []
    for page, versions in pages.items():
        row = versions[0]
        item = item_by_version.get(row["page_name_sub"]) or item_by_page.get(page) or {}
        images = item.get("image") or []
        armour_type = clean_text(row.get("equipment_type"))
        style = clean_text(row.get("attack_style"))
        damage_bonus = max(
            float(row.get(k) or 0) for k in ("strength_bonus", "ranged_bonus", "magic_bonus", "necromancy_bonus")
        )
        rows.append(
            {
                "name": page,
                "image": file_url(images[0], RS3_WIKI) if images else "",
                "equipment_slot": SLOTS.get(row.get("equipment_slot", ""), row.get("equipment_slot", "")),
                "combat_class": clean_text(row.get("combat_class")).lower().replace("none", "") or "",
                "tier": row.get("equipment_tier") or 0,
                "armour_type": "" if armour_type in ("None", "") else armour_type,
                "damage": number(row.get("weapon_damage")),
                "accuracy": number(row.get("weapon_accuracy")),
                "attack_style": "" if style in ("None", "") else style,
                "attack_speed": attack_speed(row.get("weapon_attack_speed")),
                "armour": number(row.get("equipment_armour")),
                "life_points": number(row.get("equipment_life_points")),
                "damage_bonus": number(damage_bonus),
                "prayer": number(row.get("prayer_bonus")),
                # Bucket booleans are "" when true and absent when false
                "is_member": "Yes" if "is_members_only" in item else "No",
                "release_year": release_year_for(row["page_name_sub"], release),
                "examine": clean_text(item.get("examine")),
            }
        )

    # Drop recolours/trims such as "Rune platebody (g)" whose stats match the plain item
    stat_keys = [c for c in COLUMNS if c not in ("name", "image", "is_member", "release_year", "examine")]
    cosmetic = cosmetic_copies(rows, stat_keys)
    print(f"Skipping {len(cosmetic)} cosmetic copies (e.g. {', '.join(sorted(cosmetic)[:3])})")
    rows = [r for r in rows if r["name"] not in cosmetic]

    write_csv("equipment.csv", COLUMNS, rows)


if __name__ == "__main__":
    main()
