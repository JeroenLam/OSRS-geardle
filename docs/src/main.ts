import './style.css';
import { GAMES, HINT_AFTER, type Column, type Game, type GameId, type Item, type Value } from './data';
import {
    compareItems,
    dailyTarget,
    normalizeSeed,
    randomSeed,
    seededTarget,
    todayKey,
    type Result,
} from './game';
import { setupAutocomplete } from './autocomplete';

type Mode = 'daily' | 'practice';

const input = document.querySelector<HTMLInputElement>('#guess-input')!;
const suggestions = document.querySelector<HTMLUListElement>('#suggestions')!;
const thead = document.querySelector<HTMLTableSectionElement>('#guesses thead')!;
const tbody = document.querySelector<HTMLTableSectionElement>('#guesses tbody')!;
const banner = document.querySelector<HTMLDivElement>('#banner')!;
const hint = document.querySelector<HTMLDivElement>('#hint')!;
const newGameBtn = document.querySelector<HTMLButtonElement>('#new-game')!;
const giveUpBtn = document.querySelector<HTMLButtonElement>('#give-up')!;
const footer = document.querySelector<HTMLElement>('#footer')!;
const modeTabs = document.querySelectorAll<HTMLButtonElement>('.tab[data-mode]');
const gameTabs = document.querySelectorAll<HTMLButtonElement>('.tab[data-game]');
const seedBar = document.querySelector<HTMLFormElement>('#seed-bar')!;
const seedValue = document.querySelector<HTMLElement>('#seed-value')!;
const seedInput = document.querySelector<HTMLInputElement>('#seed-input')!;
const copyLinkBtn = document.querySelector<HTMLButtonElement>('#copy-link')!;

const params = new URLSearchParams(location.search);
const debug = params.has('debug');
const itemsByName = new Map(
    Object.values(GAMES).map((g) => [g.id, new Map(g.items.map((it) => [it.name, it]))]),
);

let game: Game = GAMES.gear;
let mode: Mode = 'daily';
let dateKey = todayKey();
let target: Item = dailyTarget(game, dateKey);
let seed = '';
let guesses: Item[] = [];
let gaveUp = false;

// Gear uses "geardle-daily-<date>", matching saves from before monsters existed
const storageKey = () => `${game.keyPrefix}-daily-${dateKey}`;

function isOver(): boolean {
    return gaveUp || guesses.includes(target);
}

function saveDaily() {
    if (mode !== 'daily') return;
    localStorage.setItem(storageKey(), JSON.stringify(guesses.map((g) => g.name)));
}

function loadDaily(): Item[] {
    try {
        const names: unknown = JSON.parse(localStorage.getItem(storageKey()) ?? '[]');
        if (!Array.isArray(names)) return [];
        const lookup = itemsByName.get(game.id)!;
        return names.map((n) => lookup.get(String(n))).filter((x): x is Item => !!x);
    } catch {
        return [];
    }
}

function formatValue(col: Column, v: Value): string {
    if (col.emptyIsUnknown && (v === null || v === '' || (Array.isArray(v) && v.length === 0))) return 'Unknown';
    if (Array.isArray(v)) return v.length ? v.join(', ') : (col.emptyText ?? 'None');
    if (v === null || v === '') return col.emptyText ?? '—';
    if (col.key === 'is_member') return v === 'True' || v === 'Yes' ? 'Yes' : 'No';
    if (col.key === 'equipment_slot') return String(v).replace(/_/g, ' ');
    if (typeof v !== 'number') return String(v);
    return (col.format ? col.format(v) : String(v)) + (col.suffix ?? '');
}

const ARROWS: Partial<Record<Result, string>> = { higher: ' ▲', lower: ' ▼' };

function renderHeader() {
    const tr = document.createElement('tr');
    const th = (text: string, title?: string) => {
        const el = document.createElement('th');
        el.textContent = text;
        if (title) el.title = title;
        return el;
    };
    const noun = game.noun[0].toUpperCase() + game.noun.slice(1);
    tr.append(th(''), th(noun), ...game.columns.map((c) => th(c.label, c.title)));
    thead.replaceChildren(tr);
}

function itemCell(item: Item): HTMLTableCellElement[] {
    const imgTd = document.createElement('td');
    imgTd.className = 'img';
    const img = document.createElement('img');
    img.src = item.image;
    img.alt = item.displayName;
    imgTd.append(img);

    const nameTd = document.createElement('td');
    nameTd.className = 'name';
    nameTd.textContent = item.displayName;
    return [imgTd, nameTd];
}

function renderRow(item: Item): HTMLTableRowElement {
    const results = compareItems(game, item, target);
    const tr = document.createElement('tr');
    if (item === target) tr.classList.add('correct');
    tr.append(...itemCell(item));
    game.columns.forEach((col, i) => {
        const td = document.createElement('td');
        td.className = `cell ${results[i]}${col.kind === 'list' ? ' list' : ''}`;
        td.title = results[i] === 'unknown' ? `${col.title}: no data on the wiki` : col.title;
        td.textContent = formatValue(col, item.values[col.key]) + (ARROWS[results[i]] ?? '');
        tr.append(td);
    });
    return tr;
}

function renderBanner() {
    if (!isOver()) {
        banner.hidden = true;
        return;
    }
    const won = guesses.includes(target);
    const img = document.createElement('img');
    img.src = target.image;
    img.alt = '';
    const text = document.createElement('span');
    text.textContent = won
        ? `You got it in ${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}! The ${game.noun} was ${target.displayName}.`
        : `The ${game.noun} was ${target.displayName}.`;
    if (won && mode === 'daily') text.textContent += ' Come back tomorrow for a new one.';
    banner.className = `banner ${won ? 'won' : 'lost'}`;
    banner.replaceChildren(img, text);
    banner.hidden = false;
}

function renderHint() {
    const wrong = guesses.filter((g) => g !== target).length;
    const remaining = HINT_AFTER - wrong;
    if (isOver() && guesses.includes(target) && remaining > 0) {
        // Solved before the hint unlocked: nothing to show
        hint.hidden = true;
        return;
    }
    if (remaining > 0 && !isOver()) {
        hint.className = 'hint locked';
        hint.textContent = `${game.hintLabel} hint unlocks after ${remaining} more wrong ${remaining === 1 ? 'guess' : 'guesses'}.`;
    } else {
        hint.className = 'hint';
        const label = document.createElement('strong');
        label.textContent = `${game.hintLabel}: `;
        const text = document.createElement('span');
        text.textContent = target.examine ? `“${target.examine}”` : `No ${game.hintLabel.toLowerCase()} available for this ${game.noun}.`;
        hint.replaceChildren(label, text);
    }
    hint.hidden = false;
}

function render() {
    tbody.replaceChildren(...[...guesses].reverse().map(renderRow));
    renderBanner();
    renderHint();
    const over = isOver();
    input.disabled = over;
    input.placeholder = over ? 'Game over' : `Guess ${game.noun === 'item' ? 'an' : 'a'} ${game.noun}...`;
    newGameBtn.textContent = `New ${game.noun}`;
    newGameBtn.hidden = mode !== 'practice';
    giveUpBtn.hidden = mode !== 'practice' || over;
    seedBar.hidden = mode !== 'practice';
    seedValue.textContent = seed;
    modeTabs.forEach((t) => t.classList.toggle('active', t.dataset.mode === mode));
    gameTabs.forEach((t) => t.classList.toggle('active', t.dataset.game === game.id));
    footer.textContent = `${game.items.length} ${game.noun}s · Data from the Old School RuneScape Wiki`;
}

function gameUrl(): URL {
    const url = new URL(location.href);
    if (game.id === 'gear') url.searchParams.delete('game');
    else url.searchParams.set('game', game.id);
    if (mode === 'practice') url.searchParams.set('seed', seed);
    else url.searchParams.delete('seed');
    return url;
}

function startGame(newMode: Mode, practiceSeed?: string) {
    mode = newMode;
    gaveUp = false;
    if (mode === 'daily') {
        dateKey = todayKey();
        target = dailyTarget(game, dateKey);
        seed = '';
        guesses = loadDaily();
    } else {
        seed = practiceSeed || randomSeed();
        target = seededTarget(game, seed);
        guesses = [];
    }
    history.replaceState(null, '', gameUrl());
    if (debug) console.log(`[geardle] ${game.id} target:`, target.displayName);
    input.value = '';
    ac.close();
    renderHeader();
    render();
    if (!input.disabled) input.focus();
}

function switchGame(id: GameId) {
    if (id === game.id) return;
    game = GAMES[id];
    startGame(mode);
}

function guess(item: Item) {
    if (isOver() || guesses.includes(item)) return;
    guesses.push(item);
    saveDaily();
    render();
}

const ac = setupAutocomplete({
    input,
    list: suggestions,
    getItems: () => game.items,
    isExcluded: (item) => guesses.includes(item),
    onSelect: guess,
});

modeTabs.forEach((t) => t.addEventListener('click', () => startGame(t.dataset.mode as Mode)));
gameTabs.forEach((t) => t.addEventListener('click', () => switchGame(t.dataset.game as GameId)));
newGameBtn.addEventListener('click', () => startGame('practice'));
giveUpBtn.addEventListener('click', () => {
    gaveUp = true;
    render();
});
seedBar.addEventListener('submit', (e) => {
    e.preventDefault();
    const entered = normalizeSeed(seedInput.value);
    seedInput.value = '';
    if (entered) startGame('practice', entered);
});
copyLinkBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(gameUrl().toString());
        copyLinkBtn.textContent = 'Copied!';
    } catch {
        copyLinkBtn.textContent = 'Copy failed';
    }
    setTimeout(() => (copyLinkBtn.textContent = 'Copy link'), 1500);
});

const initialGame = params.get('game');
if (initialGame && initialGame in GAMES) game = GAMES[initialGame as GameId];
const initialSeed = normalizeSeed(params.get('seed') ?? '');
if (initialSeed) startGame('practice', initialSeed);
else startGame('daily');
