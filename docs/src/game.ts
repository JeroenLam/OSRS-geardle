import type { Column, Game, Item, Value } from './data';

export type Result = 'equal' | 'higher' | 'lower' | 'partial' | 'different';

export function compareValue(col: Column, guess: Value, target: Value): Result {
    if (col.kind === 'number' && typeof guess === 'number' && typeof target === 'number') {
        if (guess === target) return 'equal';
        // Direction points toward the target value
        return target > guess ? 'higher' : 'lower';
    }
    if (col.kind === 'list' && Array.isArray(guess) && Array.isArray(target)) {
        const shared = guess.filter((v) => target.includes(v)).length;
        if (shared === guess.length && shared === target.length) return 'equal';
        return shared > 0 ? 'partial' : 'different';
    }
    return guess === target ? 'equal' : 'different';
}

export function compareItems(game: Game, guess: Item, target: Item): Result[] {
    return game.columns.map((col) => compareValue(col, guess.values[col.key], target.values[col.key]));
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

export function dailyTarget(game: Game, dateKey: string): Item {
    return game.targets[hashString(`${game.keyPrefix}-${dateKey}`) % game.targets.length];
}

export function seededTarget(game: Game, seed: string): Item {
    // Gear keeps its original salt so previously shared seed links still work
    const salt = game.id === 'gear' ? 'practice' : `${game.keyPrefix}-practice`;
    return game.targets[hashString(`${salt}-${seed}`) % game.targets.length];
}

export function normalizeSeed(raw: string): string {
    return raw.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
}

export function randomSeed(): string {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
