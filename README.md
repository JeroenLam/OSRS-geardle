# OSRS Geardle

A Wordle-style guessing game for Old School RuneScape **and RuneScape 3**: equipment (Geardle), monsters (NPCdle), spells (Spelldle) and quests (Questdle).

Use the **OSRS / RS3** toggle at the top to switch game version; each version has its own look and its own data.

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

The RS3 versions use RS3's own stats: gear compares slot, combat class, tier, armour/weapon type, damage, accuracy, style, speed, armour, life points, damage bonus, prayer, members and release year; monsters compare combat level, release year, size, attack styles, attack speed, weaknesses, slayer category, Leagues region and life points; spells compare the same fields as OSRS (with Lodestone as a spell type); quests also compare the Age the quest is set in.

After 10 wrong guesses a hint is revealed: the examine text for gear and monsters, the in-game description for spells and quests.

**Daily** mode has one item per day for everyone. **Practice** mode picks a random item every game.

## Development

```bash
cd docs
npm install
npm run dev
```

Add `?debug` to the URL to log the target to the console. `?v=rs3` opens the RS3 version and `?game=monsters|spells|quests` picks the game.

The equipment data in `combined_equipment.csv`, item examines in `item_examines.csv` monster data in `monsters.csv` spell data in `spells.csv` and quest data in `quests.csv` are scraped (RS3 data lives in `rs3/`, scraped from the [RuneScape Wiki](https://runescape.wiki/)) from the [OSRS Wiki](https://oldschool.runescape.wiki/) using the scripts in `scraper/`. Pushes to `main` are built and deployed to GitHub Pages by `.github/workflows/deploy.yml`.
