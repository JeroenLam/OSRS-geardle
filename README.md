# OSRS Geardle

A Wordle-style guessing game for Old School RuneScape equipment (Geardle), monsters (NPCdle), spells (Spelldle) and quests (Questdle).

**Play it here: https://jeroenlam.github.io/OSRS-geardle/**

## How to play

Pick **Gear**, **Monsters**, **Spells** or **Quests**, then type a name and pick it from the suggestions. Each guess adds a row comparing its stats to the hidden one:

- 🟩 **Green**: the value matches
- 🟧 **Orange ▲ / ▼**: the hidden item's value is higher / lower
- 🟨 **Dark yellow**: partial match: some, but not all, attack styles, slayer categories, regions, runes or extra items overlap
- 🟥 **Red**: the value doesn't match (slot, members, weakness, ...)

Gear compares equipment slot, members, all combat bonuses, weight and attack speed. Monsters compare combat level, release year, size, attack style, attack speed, elemental weakness, slayer category and Leagues region. Monsters with no region data on the wiki show a grey "Unknown" region.

Spells compare spellbook, Magic level, type (combat/utility/teleport), element, runes needed, total rune count, required extra item (e.g. Book of the Dead, Unpowered orb), members, XP and release year.

Quests compare difficulty, length, required skills, the highest skill level required, the number of prerequisite quests (including nested ones), whether there are enemies to defeat, members, series and release year.

After 10 wrong guesses a hint is revealed: the examine text for gear and monsters, the in-game description for spells and quests.

**Daily** mode has one item per day for everyone. **Practice** mode picks a random item every game.

## Development

```bash
cd docs
npm install
npm run dev
```

Add `?debug` to the URL to log the target item to the console.

The equipment data in `combined_equipment.csv`, item examines in `item_examines.csv` monster data in `monsters.csv` spell data in `spells.csv` and quest data in `quests.csv` are scraped from the [OSRS Wiki](https://oldschool.runescape.wiki/) using the scripts in `scraper/`. Pushes to `main` are built and deployed to GitHub Pages by `.github/workflows/deploy.yml`.
