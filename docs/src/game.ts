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

export function seededTarget(seed: string): Item {
  return ITEMS[hashString(`practice-${seed}`) % ITEMS.length];
}

export function normalizeSeed(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
}

export function randomSeed(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
