import Papa from 'papaparse';
import equipmentCsv from '../../combined_equipment.csv?raw';
import examinesCsv from '../../item_examines.csv?raw';
import monstersCsv from '../../monsters.csv?raw';

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
}

export type Value = string | number | string[] | null;

export interface Item {
  name: string;
  displayName: string;
  image: string;
  examine: string;
  values: Record<string, Value>;
}

export type GameId = 'gear' | 'monsters';

export interface Game {
  id: GameId;
  title: string;
  /** Singular noun used in UI text, e.g. "item" */
  noun: string;
  columns: Column[];
  items: Item[];
  /** Candidates for the hidden answer (a subset of items with complete data) */
  targets: Item[];
  /** Prefix for daily/practice hashing and localStorage keys */
  keyPrefix: string;
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
  { key: 'elemental_weakness', label: 'Weakness', title: 'Elemental weakness', kind: 'text' },
  { key: 'slayer_category', label: 'Slayer', title: 'Slayer category', kind: 'list' },
  {
    key: 'league_region',
    label: 'Region',
    title: 'Leagues region(s) where it can be found',
    kind: 'list',
    emptyIsUnknown: true,
  },
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
      examine: examines.get(name) ?? row.examine?.trim() ?? '',
      values,
    });
  }
  return items.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function gearGame(): Game {
  const examines = new Map(parseCsv(examinesCsv).map((r) => [r.name, r.examine]));
  const items = loadItems(parseCsv(equipmentCsv), GEAR_COLUMNS, examines);
  return { id: 'gear', title: 'Gear', noun: 'item', columns: GEAR_COLUMNS, items, targets: items, keyPrefix: 'geardle' };
}

function monsterGame(): Game {
  const items = loadItems(parseCsv(monstersCsv), MONSTER_COLUMNS, new Map());
  // Answers must have every stat filled in, and a slayer category (bosses included)
  // so the pool is recognisable creatures rather than obscure quest NPCs.
  // Every monster can still be guessed.
  const required = ['combat_level', 'release_year', 'size', 'attack_speed'];
  const targets = items.filter(
    (it) =>
      required.every((k) => it.values[k] !== null) &&
      (it.values.attack_style as string[]).length > 0 &&
      (it.values.slayer_category as string[]).length > 0 &&
      (it.values.league_region as string[]).length > 0,
  );
  return {
    id: 'monsters',
    title: 'Monsters',
    noun: 'monster',
    columns: MONSTER_COLUMNS,
    items,
    targets,
    keyPrefix: 'geardle-monsters',
  };
}

export const GAMES: Record<GameId, Game> = {
  gear: gearGame(),
  monsters: monsterGame(),
};
