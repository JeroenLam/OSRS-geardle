# OSRS Geardle

A Wordle-style guessing game for Old School RuneScape equipment.

**Play it here: https://jeroenlam.github.io/OSRS-geardle/**

## How to play

Type an item name and pick it from the suggestions. Each guess adds a row comparing its stats to the hidden item:

- 🟩 **Green**: the value matches
- 🟧 **Orange ▲ / ▼**: the hidden item's value is higher / lower
- 🟥 **Red**: the value doesn't match (slot, members)

**Daily** mode has one item per day for everyone. **Practice** mode picks a random item every game.

## Development

```bash
cd docs
npm install
npm run dev
```

Add `?debug` to the URL to log the target item to the console.

The equipment data in `combined_equipment.csv` is scraped from the [OSRS Wiki](https://oldschool.runescape.wiki/) using the scripts in `scraper/`. Pushes to `main` are built and deployed to GitHub Pages by `.github/workflows/deploy.yml`.
