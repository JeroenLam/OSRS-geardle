# Scrapers

All data comes from the [OSRS Wiki](https://oldschool.runescape.wiki/). Run the scripts from this directory:

```bash
uv run scrape.py            # equipment slot tables -> ../output/*.csv
uv run combine_csv.py       # ../output/*.csv -> combined_equipment.csv (copy it to the repo root)
uv run scrape_examines.py   # examine text for every item in ../combined_equipment.csv -> ../item_examines.csv
uv run scrape_monsters.py   # monster infoboxes -> ../monsters.csv
uv run scrape_spells.py     # spell infoboxes -> ../spells.csv
uv run scrape_quests.py     # quest details -> ../quests.csv
```

`scrape_examines.py` and `scrape_monsters.py` use the wiki's bucket API (`wiki_bucket.py`), which returns the structured infobox data.

For monsters, there is one row per wiki page. When a page has several versions, the default version is used. Minigame copies (Nightmare Zone, Deadman, PvM Arena, ...) and unreleased variants are skipped. Attack styles are reduced to Stab/Slash/Crush/Melee/Ranged/Magic/Dragonfire/Typeless. Leagues regions are the union of the infobox's region and the regions of every spawn location on the page (`locline` bucket); "General" is dropped. Multi-value fields (attack style, slayer category, league region) are separated by `;`.

For spells, the list comes from the `infobox_spell` bucket and the details are parsed from each page's `{{Infobox Spell}}` template (the bucket does not store release date, members, element or description). Runes and the total rune count come from `{{RuneReq}}` in the cost; other required items (`{{plinkp}}`, or the Orb/Banana entries of `{{RuneReq}}`) go in `extra_items`. Leagues-only spells are skipped.

For quests, difficulty, length, requirements, enemies and description come from the `quest` bucket; members, series, release date and image from each page's `{{Infobox Quest}}`. Only pages in Category:Quests are kept (no miniquests or Recipe for Disaster subquests), and unreleased quests (no official length) are skipped. Skill requirements are read from the wiki's `data-skill`/`data-level` tags. The prerequisite count is the number of distinct quests and miniquests linked anywhere in the nested requirement list. Difficulty and length are stored as 1-based ranks so the game can show higher/lower arrows. The quest's own name is replaced with "[this quest]" in its description.
