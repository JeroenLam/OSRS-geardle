# OSRS Geardle

A Wordle-style guessing game for Old School RuneScape equipment and monsters.

**Play it here: https://jeroenlam.github.io/OSRS-geardle/**

## How to play

Pick **Gear** or **Monsters**, then type a name and pick it from the suggestions. Each guess adds a row comparing its stats to the hidden one:

- 🟩 **Green**: the value matches
- 🟧 **Orange ▲ / ▼**: the hidden item's value is higher / lower
- 🟨 **Dark yellow**: partial match: some, but not all, attack styles or slayer categories overlap
- 🟥 **Red**: the value doesn't match (slot, members, weakness, ...)

Gear compares equipment slot, members, all combat bonuses, weight and attack speed. Monsters compare combat level, release year, size, attack style, attack speed, elemental weakness and slayer category.

After 10 wrong guesses, the hidden item's or monster's examine text is revealed as a hint.

**Daily** mode has one item per day for everyone. **Practice** mode picks a random item every game.

## Development

```bash
cd docs
npm install
npm run dev
```

Add `?debug` to the URL to log the target item to the console.

The equipment data in `combined_equipment.csv`, item examines in `item_examines.csv` and monster data in `monsters.csv` are scraped from the [OSRS Wiki](https://oldschool.runescape.wiki/) using the scripts in `scraper/`. Pushes to `main` are built and deployed to GitHub Pages by `.github/workflows/deploy.yml`.
