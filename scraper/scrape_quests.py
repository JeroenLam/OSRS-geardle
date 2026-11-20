"""Scrape quest data from the OSRS Wiki into ../quests.csv.

Quest details (difficulty, length, requirements, enemies, description) come
from the `quest` bucket; release date, members, series and image are parsed
from each page's {{Infobox Quest}}. Only pages in Category:Quests are kept, so
miniquests and Recipe for Disaster subquests are left out.
"""

import csv
import re
import time
from pathlib import Path

import requests

from wiki_bucket import API_URL, HEADERS, REQUEST_TIMEOUT, clean_text, file_url, query_bucket, release_year

OUTPUT_FILE = Path("../quests.csv")

COLUMNS = [
    "name",
    "image",
    "difficulty",
    "length",
    "skills",
    "highest_skill",
    "precursor_quests",
    "has_enemies",
    "is_member",
    "series",
    "release_year",
    "description",
]

# Ordered from easiest/shortest, so the game can show higher/lower arrows.
DIFFICULTIES = ["Novice", "Intermediate", "Experienced", "Master", "Grandmaster"]
LENGTHS = ["Very Short", "Short", "Medium", "Long", "Very Long"]

DEFAULT_IMAGE = "File:Quest point icon.png"


def fetch_pages(titles: list[str]) -> dict[str, dict]:
    """Fetch wikitext and categories for each title."""
    pages: dict[str, dict] = {}
    for i in range(0, len(titles), 50):
        response = requests.get(
            API_URL,
            params={
                "action": "query",
                "prop": "revisions|categories",
                "rvprop": "content",
                "rvslots": "main",
                "cllimit": "max",
                "format": "json",
                "formatversion": "2",
                "titles": "|".join(titles[i : i + 50]),
            },
            headers=HEADERS,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        for page in response.json()["query"]["pages"]:
            pages[page["title"]] = {
                "text": page["revisions"][0]["slots"]["main"]["content"] if "revisions" in page else "",
                "categories": {c["title"] for c in page.get("categories", [])},
            }
        print(f"  fetched {len(pages)} quest pages")
        time.sleep(1)
    return pages


def parse_infobox(text: str) -> dict[str, str]:
    match = re.search(r"\{\{Infobox Quest(.*?)\n\}\}", text, re.S)
    if not match:
        return {}
    return {k: v.strip() for k, v in re.findall(r"\n\|\s*([a-z_0-9]+)\s*=(.*)", match.group(1))}


def parse_skills(requirements: str) -> dict[str, int]:
    """Skill requirements, tagged by the wiki as <span data-skill="X" data-level="N">."""
    skills: dict[str, int] = {}
    for skill, level in re.findall(r'data-skill="([^"]+)" data-level="(\d+)"', requirements or ""):
        if skill.lower() in ("quest points", "combat level", "combat"):
            continue
        skills[skill] = max(skills.get(skill, 0), int(level))
    return skills


def count_precursors(name: str, requirements: str, quest_names: set[str]) -> int:
    """Number of distinct quests/miniquests linked in the (nested) requirement list."""
    found = set()
    for target in re.findall(r"\[\[([^\]|#]+)", requirements or ""):
        target = target.split("/", 1)[0].replace("_", " ").strip()
        if target in quest_names and target != name:
            found.add(target)
    return len(found)


def has_enemies(enemies: str) -> str:
    text = clean_text(enemies).strip("* ").lower()
    return "No" if not text or text in ("none", "n/a", "no") else "Yes"


def series_name(series: str) -> str:
    """'[[Quests/Series#Gnome|Gnome]], #4' -> 'Gnome' (first series only)."""
    text = clean_text(series)
    text = re.split(r",\s*#|\s#\d", text)[0]
    return "" if text.lower() in ("none", "n/a", "no") else text.strip()


def to_row(quest: dict, info: dict[str, str], quest_names: set[str]) -> dict:
    name = quest["page_name"]
    requirements = quest.get("requirements", "")
    skills = parse_skills(requirements)
    difficulty = quest.get("official_difficulty") or ""
    length = quest.get("official_length") or ""
    image = re.search(r"File:([^\]|]+)", info.get("image", ""))
    return {
        "name": name,
        "image": file_url(image.group(0) if image else DEFAULT_IMAGE),
        # Ranks are 1-based; "Special" (Recipe for Disaster) and mixed lengths stay empty.
        "difficulty": DIFFICULTIES.index(difficulty) + 1 if difficulty in DIFFICULTIES else "",
        "length": LENGTHS.index(length) + 1 if length in LENGTHS else "",
        "skills": ";".join(sorted(skills)),
        "highest_skill": max(skills.values(), default=0),
        "precursor_quests": count_precursors(name, requirements, quest_names),
        "has_enemies": has_enemies(quest.get("enemies_to_defeat", "")),
        "is_member": "No" if clean_text(info.get("members")).lower() == "no" else "Yes",
        "series": series_name(info.get("series", "")),
        "release_year": release_year(clean_text(info.get("release"))),
        # The description is the in-game hint, so hide the quest's own name in it.
        "description": re.sub(re.escape(name), "[this quest]", clean_text(quest.get("description")), flags=re.I),
    }


def main():
    print("Downloading quest data...")
    quests = query_bucket(
        "quest",
        ["page_name", "description", "enemies_to_defeat", "official_difficulty", "official_length", "requirements"],
    )
    by_page = {q["page_name"]: q for q in quests if "/" not in q["page_name"]}
    # Miniquests can be prerequisites too, so they count towards the precursor total.
    quest_names = set(by_page)

    print("Downloading quest pages...")
    pages = fetch_pages(sorted(by_page))

    rows = []
    for name, quest in by_page.items():
        page = pages.get(name)
        if not page or "Category:Quests" not in page["categories"]:
            continue
        if not quest.get("official_length"):
            print(f"  Skipping {name}: no official length (unreleased)")
            continue
        rows.append(to_row(quest, parse_infobox(page["text"]), quest_names))
    rows.sort(key=lambda r: r["name"].lower())

    with OUTPUT_FILE.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Exported {len(rows)} quests -> {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
