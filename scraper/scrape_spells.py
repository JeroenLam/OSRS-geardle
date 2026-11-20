"""Scrape spell data from the OSRS Wiki into ../spells.csv.

The spell list comes from the infobox_spell bucket; the details (release date,
members, quest, element, cost, description) are parsed from each page's
{{Infobox Spell}} template, since the bucket does not store them.
"""

import csv
import re
import time
from pathlib import Path

import requests

from wiki_bucket import API_URL, HEADERS, REQUEST_TIMEOUT, clean_text, query_bucket, release_year

OUTPUT_FILE = Path("../spells.csv")

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

# Leagues-only and other non-standard spells.
EXCLUDED = {"League Home Teleport", "RuneScape:Templates"}

SPELLBOOKS = {
    "normal": "Standard",
    "standard": "Standard",
    "ancient": "Ancient",
    "lunar": "Lunar",
    "arceuus": "Arceuus",
    "all": "All",
}

# Display order for runes. {{RuneReq}} also takes a few non-rune items (Orb, Banana).
RUNES = ["Air", "Water", "Earth", "Fire", "Mind", "Body", "Cosmic", "Chaos", "Nature", "Law",
         "Death", "Astral", "Blood", "Soul", "Wrath"]
REQ_ITEMS = {"Orb": "Unpowered orb", "Banana": "Banana"}


def fetch_wikitext(titles: list[str]) -> dict[str, str]:
    texts: dict[str, str] = {}
    for i in range(0, len(titles), 50):
        response = requests.get(
            API_URL,
            params={
                "action": "query",
                "prop": "revisions",
                "rvprop": "content",
                "rvslots": "main",
                "format": "json",
                "formatversion": "2",
                "titles": "|".join(titles[i : i + 50]),
            },
            headers=HEADERS,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        for page in response.json()["query"]["pages"]:
            if "revisions" in page:
                texts[page["title"]] = page["revisions"][0]["slots"]["main"]["content"]
        print(f"  fetched {len(texts)} spell pages")
        time.sleep(1)
    return texts


def parse_infobox(text: str) -> dict[str, str] | None:
    match = re.search(r"\{\{Infobox Spell(.*?)\n\}\}", text, re.S)
    if not match:
        return None
    fields = {}
    for key, value in re.findall(r"\n\|\s*([a-z_0-9]+)\s*=(.*)", match.group(1)):
        fields[key] = value.strip()
    return fields


def parse_cost(cost: str) -> tuple[list[str], int, list[str]]:
    """Return (rune names, total rune count, other required items) from a cost field."""
    amounts: dict[str, int] = {}
    items: list[str] = []
    for params in re.findall(r"\{\{RuneReq\|([^}]*)\}\}", cost):
        for part in params.split("|"):
            name, _, amount = part.partition("=")
            name = name.strip().capitalize()
            if name in REQ_ITEMS:
                items.append(REQ_ITEMS[name])
            elif name in RUNES:
                amounts[name] = amounts.get(name, 0) + (int(amount) if amount.strip().isdigit() else 0)
            elif name:
                print(f"  Unknown RuneReq entry: {name}")

    for name in re.findall(r"\{\{plinkp?\|([^}|]*)", cost):
        name = name.strip()
        if name and not name.lower().endswith(" rune"):
            items.append(name)

    runes = [r for r in RUNES if r in amounts]
    return runes, sum(amounts.values()), list(dict.fromkeys(items))


def first_number(value: str) -> str:
    match = re.match(r"\s*(\d+(?:\.\d+)?)", value or "")
    return match.group(1) if match else ""


def yes_no(value: str) -> str:
    value = clean_text(value).lower()
    if not value or value in ("no", "none", "n/a"):
        return "No"
    return "Yes"


def to_row(page: str, image: str, info: dict[str, str], materials: list[str]) -> dict:
    runes, total, items = parse_cost(info.get("cost", ""))
    # Materials the bucket knows about that are not runes (e.g. Unpowered orb, Banana)
    for material in materials:
        if not material.lower().endswith(" rune") and material not in items:
            items.append(material)

    spell_type = clean_text(info.get("type")).capitalize()
    element = clean_text(info.get("element")).capitalize()
    image_file = re.search(r"File:([^\]|]+)", image or info.get("image", ""))
    return {
        "name": page,
        "image": (
            "https://oldschool.runescape.wiki/images/"
            + requests.utils.quote(image_file.group(1).strip().replace(" ", "_"))
            if image_file
            else ""
        ),
        "spellbook": SPELLBOOKS.get(clean_text(info.get("spellbook")).lower(), clean_text(info.get("spellbook"))),
        "level": first_number(clean_text(info.get("level"))),
        "type": spell_type,
        "element": "" if element in ("", "None", "N/a") else element,
        "runes": ";".join(runes),
        "rune_count": total,
        "extra_items": ";".join(items),
        "is_member": yes_no(info.get("members", "")),
        "exp": first_number(clean_text(info.get("exp"))),
        "release_year": release_year(clean_text(info.get("release"))),
        "description": clean_text(info.get("description")),
    }


def main():
    print("Downloading spell list...")
    spells = query_bucket("infobox_spell", ["page_name", "image", "uses_material"])
    by_page = {s["page_name"]: s for s in spells if s["page_name"] not in EXCLUDED}

    print("Downloading spell pages...")
    texts = fetch_wikitext(sorted(by_page))

    rows = []
    for page, spell in by_page.items():
        info = parse_infobox(texts.get(page, ""))
        if not info or not clean_text(info.get("level")):
            print(f"  Skipping {page}: no usable infobox")
            continue
        rows.append(to_row(page, spell.get("image", ""), info, spell.get("uses_material") or []))
    rows.sort(key=lambda r: r["name"].lower())

    with OUTPUT_FILE.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Exported {len(rows)} spells -> {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
