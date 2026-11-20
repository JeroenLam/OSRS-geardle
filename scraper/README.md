# Scrapers

OSRS data comes from the [OSRS Wiki](https://oldschool.runescape.wiki/) and RS3 data from the [RuneScape Wiki](https://runescape.wiki/). Run the scripts from this directory:

```bash
uv run scrape.py            # equipment slot tables -> ../output/*.csv
uv run combine_csv.py       # ../output/*.csv -> combined_equipment.csv (copy it to the repo root)
uv run scrape_examines.py   # examine text for every item in ../combined_equipment.csv -> ../item_examines.csv
uv run scrape_monsters.py   # monster infoboxes -> ../monsters.csv
uv run scrape_spells.py     # spell infoboxes -> ../spells.csv
uv run scrape_quests.py     # quest details -> ../quests.csv

# RS3 (all write to ../rs3/)
uv run scrape_rs3_gear.py       # equipment bonuses -> equipment.csv
uv run scrape_rs3_monsters.py   # monster infoboxes -> monsters.csv
uv run scrape_rs3_spells.py     # spell infoboxes -> spells.csv
uv run scrape_rs3_quests.py     # quest details -> quests.csv
```

`scrape_examines.py` and `scrape_monsters.py` use the wiki's bucket API (`wiki_bucket.py`), which returns the structured infobox data.

For monsters, there is one row per wiki page. When a page has several versions, the default version is used. Minigame copies (Nightmare Zone, Deadman, PvM Arena, ...) and unreleased variants are skipped. Attack styles are reduced to Stab/Slash/Crush/Melee/Ranged/Magic/Dragonfire/Typeless. Leagues regions are the union of the infobox's region and the regions of every spawn location on the page (`locline` bucket); "General" is dropped. Multi-value fields (attack style, slayer category, league region) are separated by `;`.

For spells, the list comes from the `infobox_spell` bucket and the details are parsed from each page's `{{Infobox Spell}}` template (the bucket does not store release date, members, element or description). Runes and the total rune count come from `{{RuneReq}}` in the cost; other required items (`{{plinkp}}`, or the Orb/Banana entries of `{{RuneReq}}`) go in `extra_items`. Leagues-only spells are skipped.

For quests, difficulty, length, requirements, enemies and description come from the `quest` bucket; members, series, release date and image from each page's `{{Infobox Quest}}`. Only pages in Category:Quests are kept (no miniquests or Recipe for Disaster subquests), and unreleased quests (no official length) are skipped. Skill requirements are read from the wiki's `data-skill`/`data-level` tags. The prerequisite count is the number of distinct quests and miniquests linked anywhere in the nested requirement list. Difficulty and length are stored as 1-based ranks so the game can show higher/lower arrows. The quest's own name is replaced with "[this quest]" in its description.

## RS3

Both wikis run the same bucket API, so `wiki_bucket.py` takes the wiki as a parameter. Release years for RS3 come from the wiki's `release_date` bucket (`rs3_common.py`).

- **Gear**: `infobox_bonuses` joined with `infobox_item` (image, examine, members). One row per item page; cosmetic recolours, "Lucky" copies, Dungeoneering class/tier copies and items without any stats are skipped. Untiered items with stats (most jewellery) are kept with tier 0. Word attack speeds ("fastest", "average", ...) are converted to ticks.
- **Monsters**: `infobox_monster`, using the most complete version of each page. Dungeoneering monsters, familiars and historical versions are skipped. The bucket has no images, so each page's main image (PageImages API) is used. The wiki leaves size empty for 1x1 monsters, so empty size is stored as 1. Bosses have no slayer category on RS3, so RS3 answers don't require one.
- **Spells**: `infobox_spell` JSON (runes with amounts, element, description). Spells from the Dungeoneering-only spellbook are skipped. Combat spell XP depends on damage, so it is left empty ("Varies").
- **Quests**: `infobox_quest` (difficulty, series, Age, members, release) and `quest` (length, skill requirements, enemies); prerequisite chains come from the wiki's `Module:Questreq/data`, and the description from each page's "Official description" section. Miniquests, subquests and removed quests are skipped. In-between lengths ("Short to Medium") are stored as half steps.
