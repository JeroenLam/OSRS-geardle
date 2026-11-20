import Papa from 'papaparse';

/** text: exact match · number: higher/lower arrows · list: set match with partial overlap */
export type ColumnKind = 'text' | 'number' | 'list';

export interface Column {
  key: string;
  label: string;
  title: string;
  kind: ColumnKind;
  suffix?: string;
  format?: (v: number) => string;
  /** Empty means "the wiki has no data", shown as unknown instead of being compared */
  emptyIsUnknown?: boolean;
  /** Text shown for an empty value (default "—", or "None" for lists) */
  emptyText?: string;
}

export type Value = string | number | string[] | null;

export interface Item {
  name: string;
  displayName: string;
  image: string;
  examine: string;
  values: Record<string, Value>;
}

export type GameId = 'gear' | 'monsters' | 'spells' | 'quests';
export type Version = 'osrs' | 'rs3';

export const VERSIONS: Record<Version, { label: string; wiki: string }> = {
  osrs: { label: 'OSRS', wiki: 'Old School RuneScape Wiki' },
  rs3: { label: 'RS3', wiki: 'RuneScape Wiki' },
};

export interface Game {
  id: GameId;
  version: Version;
  title: string;
  /** Name shown as the page heading and tab title, e.g. "Geardle" */
  gameName: string;
  /** Singular noun used in UI text, e.g. "item" */
  noun: string;
  columns: Column[];
  items: Item[];
  /** Candidates for the hidden answer (a subset of items with complete data) */
  targets: Item[];
  /** Prefix for daily/practice hashing and localStorage keys */
  keyPrefix: string;
  /** Name of the text revealed as a hint, e.g. "Examine" */
  hintLabel: string;
  byName: Map<string, Item>;
}

/** Number of wrong guesses before the examine text is revealed. */
export const HINT_AFTER = 10;

const signed = (v: number) => `${v > 0 ? '+' : ''}${v}`;

const GEAR_COLUMNS: Column[] = [
  { key: 'equipment_slot', label: 'Slot', title: 'Equipment slot', kind: 'text' },
  { key: 'is_member', label: 'P2P', title: 'Members item', kind: 'text' },
  { key: 'stab_attack', label: 'Stab', title: 'Stab attack', kind: 'number', format: signed },
  { key: 'slash_attack', label: 'Slash', title: 'Slash attack', kind: 'number', format: signed },
  { key: 'crush_attack', label: 'Crush', title: 'Crush attack', kind: 'number', format: signed },
  { key: 'magic_attack', label: 'Magic', title: 'Magic attack', kind: 'number', format: signed },
  { key: 'range_attack', label: 'Range', title: 'Ranged attack', kind: 'number', format: signed },
  { key: 'stab_defence', label: 'Stab def', title: 'Stab defence', kind: 'number', format: signed },
  { key: 'slash_defence', label: 'Slash def', title: 'Slash defence', kind: 'number', format: signed },
  { key: 'crush_defence', label: 'Crush def', title: 'Crush defence', kind: 'number', format: signed },
  { key: 'magic_defence', label: 'Magic def', title: 'Magic defence', kind: 'number', format: signed },
  { key: 'range_defence', label: 'Range def', title: 'Ranged defence', kind: 'number', format: signed },
  { key: 'strength', label: 'Str', title: 'Melee strength', kind: 'number', format: signed },
  { key: 'range_strength', label: 'R.Str', title: 'Ranged strength', kind: 'number', format: signed },
  { key: 'magic_strength', label: 'M.Dmg', title: 'Magic damage', kind: 'number', suffix: '%', format: signed },
  { key: 'prayer', label: 'Prayer', title: 'Prayer bonus', kind: 'number', format: signed },
  { key: 'weight', label: 'Weight', title: 'Weight (kg)', kind: 'number', format: (v) => v.toFixed(3) },
  { key: 'attack_speed', label: 'Speed', title: 'Attack speed (ticks)', kind: 'number' },
];

const MONSTER_COLUMNS: Column[] = [
  { key: 'combat_level', label: 'Combat', title: 'Combat level', kind: 'number' },
  { key: 'release_year', label: 'Released', title: 'Release year', kind: 'number' },
  { key: 'size', label: 'Size', title: 'Size (tiles)', kind: 'number', format: (v) => `${v}x${v}` },
  { key: 'attack_style', label: 'Attack style', title: 'Attack style(s)', kind: 'list' },
  { key: 'attack_speed', label: 'Speed', title: 'Attack speed (ticks)', kind: 'number' },
  { key: 'elemental_weakness', label: 'Weakness', title: 'Elemental weakness', kind: 'text', emptyText: 'None' },
  { key: 'slayer_category', label: 'Slayer', title: 'Slayer category', kind: 'list' },
  {
    key: 'league_region',
    label: 'Region',
    title: 'Leagues region(s) where it can be found',
    kind: 'list',
    emptyIsUnknown: true,
  },
];

const SPELL_COLUMNS: Column[] = [
  { key: 'spellbook', label: 'Spellbook', title: 'Spellbook', kind: 'text' },
  { key: 'level', label: 'Level', title: 'Magic level required', kind: 'number' },
  { key: 'type', label: 'Type', title: 'Combat, utility or teleport', kind: 'text' },
  { key: 'element', label: 'Element', title: 'Element (combat spells)', kind: 'text', emptyText: 'None' },
  { key: 'runes', label: 'Runes', title: 'Runes needed', kind: 'list' },
  { key: 'rune_count', label: 'Rune total', title: 'Total number of runes per cast', kind: 'number' },
  { key: 'extra_items', label: 'Extra item', title: 'Required item besides runes', kind: 'list' },
  { key: 'is_member', label: 'P2P', title: 'Members spell', kind: 'text' },
  { key: 'exp', label: 'XP', title: 'Magic experience per cast', kind: 'number' },
  { key: 'release_year', label: 'Released', title: 'Release year', kind: 'number' },
];

// Scraped as 1-based ranks so the game can show higher/lower arrows
const DIFFICULTIES = ['Novice', 'Intermediate', 'Experienced', 'Master', 'Grandmaster'];
const LENGTHS = ['Very Short', 'Short', 'Medium', 'Long', 'Very Long'];

const QUEST_COLUMNS: Column[] = [
  {
    key: 'difficulty',
    label: 'Difficulty',
    title: 'Official difficulty',
    kind: 'number',
    format: (v) => DIFFICULTIES[v - 1] ?? String(v),
    emptyText: 'Special',
  },
  {
    key: 'length',
    label: 'Length',
    title: 'Official length',
    kind: 'number',
    format: (v) => LENGTHS[v - 1] ?? String(v),
  },
  { key: 'skills', label: 'Skills', title: 'Skills with a level requirement', kind: 'list' },
  { key: 'highest_skill', label: 'Top skill lvl', title: 'Highest skill level required', kind: 'number' },
  {
    key: 'precursor_quests',
    label: 'Pre-quests',
    title: 'Number of quests (and miniquests) that must be completed first, including nested ones',
    kind: 'number',
  },
  { key: 'has_enemies', label: 'Enemies', title: 'Has enemies to defeat', kind: 'text' },
  { key: 'is_member', label: 'P2P', title: 'Members quest', kind: 'text' },
  { key: 'series', label: 'Series', title: 'Quest series', kind: 'text', emptyText: 'None' },
  { key: 'release_year', label: 'Released', title: 'Release year', kind: 'number' },
];

// ---------------------------------------------------------------- RS3

const RS3_GEAR_COLUMNS: Column[] = [
  { key: 'equipment_slot', label: 'Slot', title: 'Equipment slot', kind: 'text' },
  { key: 'combat_class', label: 'Class', title: 'Combat class', kind: 'text', emptyText: 'None' },
  { key: 'tier', label: 'Tier', title: 'Equipment tier', kind: 'number' },
  { key: 'armour_type', label: 'Type', title: 'Armour or weapon type', kind: 'text', emptyText: 'None' },
  { key: 'damage', label: 'Damage', title: 'Weapon damage', kind: 'number' },
  { key: 'accuracy', label: 'Accuracy', title: 'Weapon accuracy', kind: 'number' },
  { key: 'attack_style', label: 'Style', title: 'Attack style', kind: 'text', emptyText: 'None' },
  { key: 'attack_speed', label: 'Speed', title: 'Attack speed (ticks)', kind: 'number' },
  { key: 'armour', label: 'Armour', title: 'Armour rating', kind: 'number' },
  { key: 'life_points', label: 'LP', title: 'Life points bonus', kind: 'number' },
  { key: 'damage_bonus', label: 'Dmg bonus', title: 'Strength / ranged / magic / necromancy damage bonus', kind: 'number' },
  { key: 'prayer', label: 'Prayer', title: 'Prayer bonus', kind: 'number' },
  { key: 'is_member', label: 'P2P', title: 'Members item', kind: 'text' },
  { key: 'release_year', label: 'Released', title: 'Release year', kind: 'number' },
];

const RS3_MONSTER_COLUMNS: Column[] = [
  { key: 'combat_level', label: 'Combat', title: 'Combat level', kind: 'number' },
  { key: 'release_year', label: 'Released', title: 'Release year', kind: 'number' },
  { key: 'size', label: 'Size', title: 'Size (tiles)', kind: 'number', format: (v) => `${v}x${v}` },
  { key: 'attack_style', label: 'Attack style', title: 'Attack style(s)', kind: 'list' },
  { key: 'attack_speed', label: 'Speed', title: 'Attack speed (ticks)', kind: 'number' },
  { key: 'weakness', label: 'Weakness', title: 'Weakness(es)', kind: 'list' },
  { key: 'slayer_category', label: 'Slayer', title: 'Slayer category', kind: 'list' },
  {
    key: 'league_region',
    label: 'Region',
    title: 'Leagues region(s) where it can be found',
    kind: 'list',
    emptyIsUnknown: true,
  },
  { key: 'life_points', label: 'LP', title: 'Life points', kind: 'number' },
];

const RS3_SPELL_COLUMNS: Column[] = [
  { key: 'spellbook', label: 'Spellbook', title: 'Spellbook', kind: 'text' },
  { key: 'level', label: 'Level', title: 'Magic level required', kind: 'number' },
  { key: 'type', label: 'Type', title: 'Combat, skilling, teleport or lodestone', kind: 'text' },
  { key: 'element', label: 'Element', title: 'Element (combat spells)', kind: 'text', emptyText: 'None' },
  { key: 'runes', label: 'Runes', title: 'Runes needed', kind: 'list' },
  { key: 'rune_count', label: 'Rune total', title: 'Total number of runes per cast', kind: 'number' },
  { key: 'extra_items', label: 'Extra item', title: 'Required item besides runes', kind: 'list' },
  { key: 'is_member', label: 'P2P', title: 'Members spell', kind: 'text' },
  { key: 'exp', label: 'XP', title: 'Magic experience per cast (combat spells vary with damage)', kind: 'number', emptyText: 'Varies' },
  { key: 'release_year', label: 'Released', title: 'Release year', kind: 'number' },
];

// RS3 has in-between lengths, scraped as half steps
const RS3_LENGTHS: Record<number, string> = {
  1: 'Very Short',
  2: 'Short',
  2.5: 'Short–Medium',
  3: 'Medium',
  3.5: 'Medium–Long',
  4: 'Long',
  4.5: 'Long–Very Long',
  5: 'Very Long',
  6: 'Very, Very Long',
};

const RS3_QUEST_COLUMNS: Column[] = [
  ...QUEST_COLUMNS.slice(0, 1),
  { key: 'length', label: 'Length', title: 'Official length', kind: 'number', format: (v) => RS3_LENGTHS[v] ?? String(v) },
  ...QUEST_COLUMNS.slice(2, -1),
  { key: 'age', label: 'Age', title: 'Age the quest is set in', kind: 'text', emptyText: 'None' },
  ...QUEST_COLUMNS.slice(-1),
];

function parseCsv(text: string): Record<string, string>[] {
  return Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: true,
  }).data;
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/[+%]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseValue(col: Column, raw: string): Value {
  if (col.kind === 'number') return parseNumber(raw);
  if (col.kind === 'list') return raw.split(';').map((s) => s.trim()).filter(Boolean);
  return raw.trim();
}

function toDisplayName(name: string): string {
  const [base, variant] = name.split('#', 2);
  return variant ? `${base} (${variant})` : base;
}

function loadItems(
  rows: Record<string, string>[],
  columns: Column[],
  examines: Map<string, string>,
): Item[] {
  const seen = new Set<string>();
  const items: Item[] = [];
  for (const row of rows) {
    const name = row.name?.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);

    const values: Record<string, Value> = {};
    for (const col of columns) values[col.key] = parseValue(col, row[col.key] ?? '');
    items.push({
      name,
      displayName: toDisplayName(name),
      image: row.image ?? '',
      examine: examines.get(name) ?? (row.examine || row.description || '').trim(),
      values,
    });
  }
  return items.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

type Csv = () => Promise<string>;

interface GameDef {
  id: GameId;
  title: string;
  gameName: string;
  noun: string;
  columns: Column[];
  keyPrefix: string;
  hintLabel: string;
  csv: Csv;
  /** Optional name,examine CSV joined onto the items */
  examines?: Csv;
  /** Which items can be the answer; defaults to all */
  isTarget?: (item: Item) => boolean;
}

const listFilled = (item: Item, key: string) => (item.values[key] as string[]).length > 0;
const allFilled = (item: Item, keys: string[]) => keys.every((k) => item.values[k] !== null);

// Data is split per game so only the selected game is downloaded.
const raw = (load: Promise<{ default: string }>) => load.then((m) => m.default);

const GAME_DEFS: Record<Version, Record<GameId, GameDef>> = {
  osrs: {
    gear: {
      id: 'gear',
      title: 'Gear',
      gameName: 'Geardle',
      noun: 'item',
      columns: GEAR_COLUMNS,
      // OSRS keys predate the other games; they are kept so saves and seed links still work
      keyPrefix: 'geardle',
      hintLabel: 'Examine',
      csv: () => raw(import('../../combined_equipment.csv?raw')),
      examines: () => raw(import('../../item_examines.csv?raw')),
    },
    monsters: {
      id: 'monsters',
      title: 'Monsters',
      gameName: 'NPCdle',
      noun: 'monster',
      columns: MONSTER_COLUMNS,
      keyPrefix: 'geardle-monsters',
      hintLabel: 'Examine',
      csv: () => raw(import('../../monsters.csv?raw')),
      // Answers must have every stat filled in, and a slayer category (bosses included)
      // so the pool is recognisable creatures rather than obscure quest NPCs.
      isTarget: (it) =>
        allFilled(it, ['combat_level', 'release_year', 'size', 'attack_speed']) &&
        listFilled(it, 'attack_style') &&
        listFilled(it, 'slayer_category') &&
        listFilled(it, 'league_region'),
    },
    spells: {
      id: 'spells',
      title: 'Spells',
      gameName: 'Spelldle',
      noun: 'spell',
      columns: SPELL_COLUMNS,
      keyPrefix: 'geardle-spells',
      hintLabel: 'Description',
      csv: () => raw(import('../../spells.csv?raw')),
    },
    quests: {
      id: 'quests',
      title: 'Quests',
      gameName: 'Questdle',
      noun: 'quest',
      columns: QUEST_COLUMNS,
      keyPrefix: 'geardle-quests',
      hintLabel: 'Description',
      csv: () => raw(import('../../quests.csv?raw')),
    },
  },
  rs3: {
    gear: {
      id: 'gear',
      title: 'Gear',
      gameName: 'Geardle',
      noun: 'item',
      columns: RS3_GEAR_COLUMNS,
      keyPrefix: 'rs3-geardle',
      hintLabel: 'Examine',
      csv: () => raw(import('../../rs3/equipment.csv?raw')),
    },
    monsters: {
      id: 'monsters',
      title: 'Monsters',
      gameName: 'NPCdle',
      noun: 'monster',
      columns: RS3_MONSTER_COLUMNS,
      keyPrefix: 'rs3-geardle-monsters',
      hintLabel: 'Examine',
      csv: () => raw(import('../../rs3/monsters.csv?raw')),
      // RS3 bosses have no slayer category, so answers only need complete combat data
      isTarget: (it) =>
        allFilled(it, ['combat_level', 'release_year', 'attack_speed']) &&
        listFilled(it, 'attack_style') &&
        listFilled(it, 'league_region'),
    },
    spells: {
      id: 'spells',
      title: 'Spells',
      gameName: 'Spelldle',
      noun: 'spell',
      columns: RS3_SPELL_COLUMNS,
      keyPrefix: 'rs3-geardle-spells',
      hintLabel: 'Description',
      csv: () => raw(import('../../rs3/spells.csv?raw')),
    },
    quests: {
      id: 'quests',
      title: 'Quests',
      gameName: 'Questdle',
      noun: 'quest',
      columns: RS3_QUEST_COLUMNS,
      keyPrefix: 'rs3-geardle-quests',
      hintLabel: 'Description',
      csv: () => raw(import('../../rs3/quests.csv?raw')),
    },
  },
};

export const GAME_IDS: GameId[] = ['gear', 'monsters', 'spells', 'quests'];

const cache = new Map<string, Promise<Game>>();

/** Load (once) and parse a game's data. */
export function loadGame(version: Version, id: GameId): Promise<Game> {
  const cacheKey = `${version}/${id}`;
  let game = cache.get(cacheKey);
  if (!game) {
    const def = GAME_DEFS[version][id];
    game = Promise.all([def.csv(), def.examines?.() ?? Promise.resolve('')]).then(([csv, examinesCsv]) => {
      const examines = new Map(examinesCsv ? parseCsv(examinesCsv).map((r) => [r.name, r.examine]) : []);
      const items = loadItems(parseCsv(csv), def.columns, examines);
      const { csv: _csv, examines: _ex, isTarget, ...meta } = def;
      return {
        ...meta,
        version,
        items,
        targets: isTarget ? items.filter(isTarget) : items,
        byName: new Map(items.map((it) => [it.name, it])),
      };
    });
    game.catch(() => cache.delete(cacheKey));
    cache.set(cacheKey, game);
  }
  return game;
}

export function gameMeta(version: Version, id: GameId): { gameName: string; noun: string } {
  return GAME_DEFS[version][id];
}
