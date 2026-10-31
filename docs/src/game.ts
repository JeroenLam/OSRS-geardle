import { COLUMNS, ITEMS, type Column, type Item, type Value } from './data';

export type Result = 'equal' | 'higher' | 'lower' | 'different';

export function compareValue(col: Column, guess: Value, target: Value): Result {
  if (col.kind === 'number' && typeof guess === 'number' && typeof target === 'number') {
    if (guess === target) return 'equal';
    // Direction points toward the target value
    return target > guess ? 'higher' : 'lower';
  }
  return guess === target ? 'equal' : 'different';
}

export function compareItems(guess: Item, target: Item): Result[] {
  return COLUMNS.map((col) => compareValue(col, guess.values[col.key], target.values[col.key]));
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function dailyTarget(dateKey: string): Item {
  return ITEMS[hashString(`geardle-${dateKey}`) % ITEMS.length];
}

export function randomTarget(exclude?: Item): Item {
  let item: Item;
  do {
    item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
  } while (ITEMS.length > 1 && item === exclude);
  return item;
}
