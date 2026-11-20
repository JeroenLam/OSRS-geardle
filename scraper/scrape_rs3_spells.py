"""Scrape RS3 spells from runescape.wiki into ../rs3/spells.csv.

All details come from the JSON stored in the infobox_spell bucket.
Spells from the Dungeoneering-only spellbook are skipped (spellbook "daemonheim"
is not in SPELLBOOKS; the "daemonheim" flag only means it can also be cast there).
"""

import json
import re

from rs3_common import load_release_years, release_year_for, write_csv
from wiki_bucket import RS3_WIKI, clean_text, file_url, query_bucket

COLUMNS = [
    "name",
    "image",
    "spellbook",
    "level",
    "type",
    "element",
    "runes",
    "rune_count",
    "extra_items",
    "is_member",
    "exp",
    "release_year",
    "description",
]

SPELLBOOKS = {"standard": "Standard", "ancient": "Ancient", "lunar": "Lunar", "all": "All"}

RUNE_ORDER = ["Air", "Water", "Earth", "Fire", "Mind", "Body", "Cosmic", "Chaos", "Nature", "Law",
              "Death", "Astral", "Blood", "Soul", "Time", "Armadyl"]


def number(value) -> str:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return ""
    return str(int(n)) if n == int(n) else f"{n:g}"


def parse_runes(entries) -> tuple[list[str], int, list[str]]:
    amounts: dict[str, int] = {}
    items: list[str] = []
    for entry in entries or []:
        name = clean_text(entry.get("name"))
        qty = int(entry.get("qty") or 0)
        match = re.fullmatch(r"(\w+) rune", name)
        if match and match.group(1) in RUNE_ORDER:
            amounts[match.group(1)] = amounts.get(match.group(1), 0) + qty
        elif name:
            items.append(name)
    runes = [r for r in RUNE_ORDER if r in amounts]
    return runes, sum(amounts.values()), items


def main():
    print("Downloading RS3 spell data...")
    spells = query_bucket("infobox_spell", ["page_name", "page_name_sub", "is_members_only", "json"], RS3_WIKI)
    release = load_release_years()

    rows = []
    seen = set()
    for spell in spells:
        data = json.loads(spell.get("json") or "{}")
        book = SPELLBOOKS.get(str(data.get("spellbook", "")).lower())
        name = spell["page_name"]
        if not book or "level" not in data or name in seen:
            continue
        seen.add(name)

        runes, total, items = parse_runes(data.get("runes"))
        for item in re.findall(r"\[\[([^\]|]+)", str(data.get("equipment") or "")):
            if not item.startswith("File:") and item not in items:
                items.append(item)
        element = clean_text(data.get("element")).capitalize()
        description = clean_text(re.sub(r"<br\s*/?>", " ", str(data.get("description") or "")))
        rows.append(
            {
                "name": name,
                "image": file_url(str(data.get("image") or ""), RS3_WIKI),
                "spellbook": book,
                "level": number(data.get("level")),
                "type": clean_text(data.get("type")).capitalize(),
                "element": "" if element in ("", "None") else element,
                "runes": ";".join(runes),
                "rune_count": total,
                "extra_items": ";".join(items),
                "is_member": "Yes" if "is_members_only" in spell else "No",
                # Combat spell XP depends on damage dealt; the wiki lists it as 0
                "exp": "" if str(data.get("type")).lower() == "combat" and not data.get("exp") else number(data.get("exp")),
                "release_year": release_year_for(spell["page_name_sub"], release),
                # The description is the hint, so hide the spell's own name
                "description": re.sub(re.escape(name), "[this spell]", description, flags=re.I),
            }
        )

    write_csv("spells.csv", COLUMNS, rows)


if __name__ == "__main__":
    main()
