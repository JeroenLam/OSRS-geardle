# Scrapers

All data comes from the [OSRS Wiki](https://oldschool.runescape.wiki/). Run the scripts from this directory:

```bash
uv run scrape.py            # equipment slot tables -> ../output/*.csv
uv run combine_csv.py       # ../output/*.csv -> combined_equipment.csv (copy it to the repo root)
uv run scrape_examines.py   # examine text for every item in ../combined_equipment.csv -> ../item_examines.csv
uv run scrape_monsters.py   # monster infoboxes -> ../monsters.csv
```

`scrape_examines.py` and `scrape_monsters.py` use the wiki's bucket API (`wiki_bucket.py`), which returns the structured infobox data.

For monsters, there is one row per wiki page. When a page has several versions, the default version is used. Minigame copies (Nightmare Zone, Deadman, PvM Arena, ...) and unreleased variants are skipped. Attack styles are reduced to Stab/Slash/Crush/Melee/Ranged/Magic/Dragonfire/Typeless. Leagues regions are the union of the infobox's region and the regions of every spawn location on the page (`locline` bucket); "General" is dropped. Multi-value fields (attack style, slayer category, league region) are separated by `;`.
