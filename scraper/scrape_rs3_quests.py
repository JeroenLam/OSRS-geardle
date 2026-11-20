"""Scrape RS3 quests from runescape.wiki into ../rs3/quests.csv.

Difficulty, series, age, members and release date come from the
infobox_quest bucket; length, skill requirements and enemies from the quest
bucket; prerequisite chains from Module:Questreq/data; the description from each page's "Official
description" section. Only released, current quests are kept (no
miniquests, subquests or removed quests).
"""

import json
import re

from rs3_common import write_csv
from wiki_bucket import RS3_WIKI, clean_text, fetch_wikitext, file_url, query_bucket, release_year

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
    "age",
    "release_year",
    "description",
]

# Ranked so the game can show higher/lower arrows. RS3 also has in-between
# lengths, which get half steps.
DIFFICULTIES = ["Novice", "Intermediate", "Experienced", "Master", "Grandmaster"]
LENGTHS = {
    "very short": 1,
    "short": 2,
    "short to medium": 2.5,
    "medium": 3,
    "medium to long": 3.5,
    "long": 4,
    "long to very long": 4.5,
    "very long": 5,
    "very, very long": 6,
}
AGES = {"5": "Fifth Age", "6": "Sixth Age", "chaos": "Age of Chaos", "ambiguous": "Ambiguous"}
NOT_SKILLS = {"quest points", "combat", "combat level", "total level"}


def parse_skills(levels: list[str]) -> dict[str, int]:
    """'attack:40' entries -> {'Attack': 40}, keeping the highest level per skill."""
    skills: dict[str, int] = {}
    for entry in levels or []:
        skill, _, level = str(entry).rpartition(":")
        skill = skill.strip().lower()
        if skill in NOT_SKILLS or not level.strip().isdigit():
            continue
        name = skill.title()
        skills[name] = max(skills.get(name, 0), int(level))
    return skills


def load_prerequisites() -> dict[str, list[str]]:
    """Direct quest prerequisites from the wiki's Module:Questreq/data Lua table."""
    text = fetch_wikitext(["Module:Questreq/data"], RS3_WIKI)["Module:Questreq/data"]["text"]
    prereqs: dict[str, list[str]] = {}
    for quest, body in re.findall(r'\["(.+?)"\]\s*=\s*\{(.*?)\}', text):
        names = []
        for entry in re.findall(r'"((?:[^"\\]|\\.)*)"', body):
            prefix, sep, rest = entry.partition(":")
            if not sep:
                names.append(entry)
            elif prefix in ("Partial", "Full", "Follows"):
                names.append(rest)
            elif prefix != "Misc":
                names.append(prefix)  # e.g. "Recipe for Disaster:<subquest>"
        prereqs[quest] = names
    return prereqs


def count_precursors(name: str, prereqs: dict[str, list[str]]) -> int:
    """Number of distinct quests that must be completed first, nested ones included."""
    found: set[str] = set()
    stack = list(prereqs.get(name, []))
    while stack:
        quest = stack.pop()
        if quest in found or quest == name:
            continue
        found.add(quest)
        stack.extend(prereqs.get(quest, []))
    return len(found)


def official_description(text: str) -> str:
    """The newest quote in the page's ==Official description== section."""
    match = re.search(r"==\s*Official description\s*==(.*?)(?:\n==[^=]|$)", text or "", re.S | re.I)
    if not match:
        return ""
    quotes = re.findall(r"\{\{\s*cquote2?\s*\|(.*?)\}\}", match.group(1), re.S | re.I)
    return clean_text(quotes[-1]) if quotes else ""


def has_enemies(kills: str) -> str:
    text = clean_text(kills).strip("* ").lower()
    return "No" if not text or text.startswith(("none", "n/a", "no ")) or text == "no" else "Yes"


def main():
    print("Downloading RS3 quest data...")
    infos = query_bucket(
        "infobox_quest",
        [
            "page_name",
            "is_members_only",
            "official_difficulty",
            "official_series",
            "official_age",
            "quest_type",
            "subquest_of",
            "release_date",
            "removal_date",
        ],
        RS3_WIKI,
    )
    details = {
        q["page_name"]: q
        for q in query_bucket(
            "quest", ["page_name", "icon", "official_length", "requirement_skill_level", "json"], RS3_WIKI
        )
    }
    prereqs = load_prerequisites()

    quests = [
        i
        for i in infos
        if i.get("quest_type") == "quest" and not i.get("subquest_of") and not i.get("removal_date") and i.get("release_date")
    ]

    print("Downloading quest pages for descriptions...")
    pages = fetch_wikitext(sorted(i["page_name"] for i in quests), RS3_WIKI)

    rows = []
    for info in quests:
        name = info["page_name"]
        detail = details.get(name, {})
        data = json.loads(detail.get("json") or "{}")
        skills = parse_skills(detail.get("requirement_skill_level"))
        difficulty = clean_text(info.get("official_difficulty"))
        length = LENGTHS.get(clean_text(detail.get("official_length")).lower(), "")
        series = clean_text(info.get("official_series"))
        description = official_description(pages.get(name, {}).get("text", ""))
        rows.append(
            {
                "name": name,
                "image": file_url(detail.get("icon") or "", RS3_WIKI),
                "difficulty": DIFFICULTIES.index(difficulty) + 1 if difficulty in DIFFICULTIES else "",
                "length": length,
                "skills": ";".join(sorted(skills)),
                "highest_skill": max(skills.values(), default=0),
                "precursor_quests": count_precursors(name, prereqs),
                "has_enemies": has_enemies(data.get("kills", "")),
                "is_member": "Yes" if "is_members_only" in info else "No",
                "series": "" if series.lower() in ("none", "") else series,
                "age": AGES.get(str(info.get("official_age", "")).lower(), ""),
                "release_year": release_year(info.get("release_date", "")),
                # The description is the hint, so hide the quest's own name
                "description": re.sub(re.escape(name), "[this quest]", description, flags=re.I),
            }
        )

    write_csv("quests.csv", COLUMNS, rows)


if __name__ == "__main__":
    main()
