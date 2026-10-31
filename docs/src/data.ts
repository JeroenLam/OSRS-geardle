import Papa from 'papaparse';
import csvText from '../../combined_equipment.csv?raw';

export type ColumnKind = 'text' | 'number';

export interface Column {
  key: string;
  label: string;
  title: string;
  kind: ColumnKind;
  suffix?: string;
}

export const COLUMNS: Column[] = [
  { key: 'equipment_slot', label: 'Slot', title: 'Equipment slot', kind: 'text' },
  { key: 'is_member', label: 'P2P', title: 'Members item', kind: 'text' },
  { key: 'stab_attack', label: 'Stab', title: 'Stab attack', kind: 'number' },
  { key: 'slash_attack', label: 'Slash', title: 'Slash attack', kind: 'number' },
  { key: 'crush_attack', label: 'Crush', title: 'Crush attack', kind: 'number' },
  { key: 'magic_attack', label: 'Magic', title: 'Magic attack', kind: 'number' },
  { key: 'range_attack', label: 'Range', title: 'Ranged attack', kind: 'number' },
  { key: 'stab_defence', label: 'Stab def', title: 'Stab defence', kind: 'number' },
  { key: 'slash_defence', label: 'Slash def', title: 'Slash defence', kind: 'number' },
  { key: 'crush_defence', label: 'Crush def', title: 'Crush defence', kind: 'number' },
  { key: 'magic_defence', label: 'Magic def', title: 'Magic defence', kind: 'number' },
  { key: 'range_defence', label: 'Range def', title: 'Ranged defence', kind: 'number' },
  { key: 'strength', label: 'Str', title: 'Melee strength', kind: 'number' },
  { key: 'range_strength', label: 'R.Str', title: 'Ranged strength', kind: 'number' },
  { key: 'magic_strength', label: 'M.Dmg', title: 'Magic damage', kind: 'number', suffix: '%' },
  { key: 'prayer', label: 'Prayer', title: 'Prayer bonus', kind: 'number' },
  { key: 'weight', label: 'Weight', title: 'Weight (kg)', kind: 'number' },
  { key: 'attack_speed', label: 'Speed', title: 'Attack speed (ticks)', kind: 'number' },
];

export type Value = string | number | null;

export interface Item {
  name: string;
  displayName: string;
  image: string;
  values: Record<string, Value>;
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/[+%]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toDisplayName(name: string): string {
  const [base, variant] = name.split('#', 2);
  return variant ? `${base} (${variant})` : base;
}

function loadItems(): Item[] {
  const parsed = Papa.parse<Record<string, string>>(csvText.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: true,
  });

  const seen = new Set<string>();
  const items: Item[] = [];
  for (const row of parsed.data) {
    const name = row.name?.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);

    const values: Record<string, Value> = {};
    for (const col of COLUMNS) {
      const raw = row[col.key] ?? '';
      values[col.key] = col.kind === 'number' ? parseNumber(raw) : raw.trim();
    }
    items.push({ name, displayName: toDisplayName(name), image: row.image ?? '', values });
  }

  return items.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export const ITEMS: Item[] = loadItems();
