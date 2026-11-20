import './style.css';
import {
    GAME_IDS,
    HINT_AFTER,
    VERSIONS,
    gameMeta,
    loadGame,
    type Column,
    type Game,
    type GameId,
    type Item,
    type Value,
    type Version,
} from './data';
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
const heading = document.querySelector<HTMLHeadingElement>('h1')!;
const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!;
const newGameBtn = document.querySelector<HTMLButtonElement>('#new-game')!;
const giveUpBtn = document.querySelector<HTMLButtonElement>('#give-up')!;
const footer = document.querySelector<HTMLElement>('#footer')!;
const versionTabs = document.querySelectorAll<HTMLButtonElement>('.tab[data-version]');
const modeTabs = document.querySelectorAll<HTMLButtonElement>('.tab[data-mode]');
const gameTabs = document.querySelectorAll<HTMLButtonElement>('.tab[data-game]');
const seedBar = document.querySelector<HTMLFormElement>('#seed-bar')!;
const seedValue = document.querySelector<HTMLElement>('#seed-value')!;
const seedInput = document.querySelector<HTMLInputElement>('#seed-input')!;
const copyLinkBtn = document.querySelector<HTMLButtonElement>('#copy-link')!;

const params = new URLSearchParams(location.search);
const debug = params.has('debug');

let version: Version = params.get('v') === 'rs3' ? 'rs3' : 'osrs';
let gameId: GameId = GAME_IDS.includes(params.get('game') as GameId) ? (params.get('game') as GameId) : 'gear';
/** The loaded game; null while its data is downloading */
let game: Game | null = null;
let mode: Mode = 'daily';
let dateKey = todayKey();
let target: Item | null = null;
let seed = '';
let guesses: Item[] = [];
let gaveUp = false;
/** Guards against a slow download finishing after the player already switched game */
let loadToken = 0;

// OSRS gear uses "geardle-daily-<date>", matching saves from before the other games existed
const storageKey = (g: Game) => `${g.keyPrefix}-daily-${dateKey}`;

function isOver(): boolean {
    return gaveUp || (target !== null && guesses.includes(target));
}

function saveDaily() {
    if (mode !== 'daily' || !game) return;
    localStorage.setItem(storageKey(game), JSON.stringify(guesses.map((g) => g.name)));
}

function loadDaily(g: Game): Item[] {
    try {
        const names: unknown = JSON.parse(localStorage.getItem(storageKey(g)) ?? '[]');
        if (!Array.isArray(names)) return [];
        return names.map((n) => g.byName.get(String(n))).filter((x): x is Item => !!x);
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

function renderHeader(g: Game) {
    const tr = document.createElement('tr');
    const th = (text: string, title?: string) => {
        const el = document.createElement('th');
        el.textContent = text;
        if (title) el.title = title;
        return el;
    };
    const noun = g.noun[0].toUpperCase() + g.noun.slice(1);
    tr.append(th(''), th(noun), ...g.columns.map((c) => th(c.label, c.title)));
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

function renderRow(g: Game, goal: Item, item: Item): HTMLTableRowElement {
    const results = compareItems(g, item, goal);
    const tr = document.createElement('tr');
    if (item === goal) tr.classList.add('correct');
    tr.append(...itemCell(item));
    g.columns.forEach((col, i) => {
        const td = document.createElement('td');
        td.className = `cell ${results[i]}${col.kind === 'list' ? ' list' : ''}`;
        td.title = results[i] === 'unknown' ? `${col.title}: no data on the wiki` : col.title;
        td.textContent = formatValue(col, item.values[col.key]) + (ARROWS[results[i]] ?? '');
        tr.append(td);
    });
    return tr;
}

function renderBanner(g: Game, goal: Item) {
    if (!isOver()) {
        banner.hidden = true;
        return;
    }
    const won = guesses.includes(goal);
    const img = document.createElement('img');
    img.src = goal.image;
    img.alt = '';
    const text = document.createElement('span');
    text.textContent = won
        ? `You got it in ${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}! The ${g.noun} was ${goal.displayName}.`
        : `The ${g.noun} was ${goal.displayName}.`;
    if (won && mode === 'daily') text.textContent += ' Come back tomorrow for a new one.';
    banner.className = `banner ${won ? 'won' : 'lost'}`;
    banner.replaceChildren(img, text);
    banner.hidden = false;
}

function renderHint(g: Game, goal: Item) {
    const wrong = guesses.filter((x) => x !== goal).length;
    const remaining = HINT_AFTER - wrong;
    if (isOver() && guesses.includes(goal) && remaining > 0) {
        // Solved before the hint unlocked: nothing to show
        hint.hidden = true;
        return;
    }
    if (remaining > 0 && !isOver()) {
        hint.className = 'hint locked';
        hint.textContent = `${g.hintLabel} hint unlocks after ${remaining} more wrong ${remaining === 1 ? 'guess' : 'guesses'}.`;
    } else {
        hint.className = 'hint';
        const label = document.createElement('strong');
        label.textContent = `${g.hintLabel}: `;
        const text = document.createElement('span');
        text.textContent = goal.examine ? `“${goal.examine}”` : `No ${g.hintLabel.toLowerCase()} available for this ${g.noun}.`;
        hint.replaceChildren(label, text);
    }
    hint.hidden = false;
}

/** Title, theme and tabs: everything that is known before the game data has loaded. */
function renderChrome() {
    const { gameName, noun } = gameMeta(version, gameId);
    const name = `${VERSIONS[version].label} ${gameName}`;
    heading.textContent = name;
    document.title = name;
    document.documentElement.dataset.theme = version;
    themeColor.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#1e1b16';
    versionTabs.forEach((t) => t.classList.toggle('active', t.dataset.version === version));
    modeTabs.forEach((t) => t.classList.toggle('active', t.dataset.mode === mode));
    gameTabs.forEach((t) => t.classList.toggle('active', t.dataset.game === gameId));
    newGameBtn.textContent = `New ${noun}`;
    newGameBtn.hidden = mode !== 'practice';
    seedBar.hidden = mode !== 'practice';
    seedValue.textContent = seed;
}

function render() {
    renderChrome();
    if (!game || !target) {
        input.disabled = true;
        input.placeholder = 'Loading…';
        giveUpBtn.hidden = true;
        hint.hidden = true;
        banner.hidden = true;
        tbody.replaceChildren();
        footer.textContent = `Loading… · Data from the ${VERSIONS[version].wiki}`;
        return;
    }
    const g = game;
    const goal = target;
    tbody.replaceChildren(...[...guesses].reverse().map((item) => renderRow(g, goal, item)));
    renderBanner(g, goal);
    renderHint(g, goal);
    const over = isOver();
    input.disabled = over;
    input.placeholder = over ? 'Game over' : `Guess ${g.noun === 'item' ? 'an' : 'a'} ${g.noun}...`;
    giveUpBtn.hidden = mode !== 'practice' || over;
    footer.textContent = `${g.items.length} ${g.noun}s · Data from the ${VERSIONS[version].wiki}`;
}

function gameUrl(): URL {
    const url = new URL(location.href);
    if (version === 'osrs') url.searchParams.delete('v');
    else url.searchParams.set('v', version);
    if (gameId === 'gear') url.searchParams.delete('game');
    else url.searchParams.set('game', gameId);
    if (mode === 'practice') url.searchParams.set('seed', seed);
    else url.searchParams.delete('seed');
    return url;
}

async function startGame(newMode: Mode, practiceSeed?: string) {
    const token = ++loadToken;
    mode = newMode;
    gaveUp = false;
    seed = mode === 'practice' ? practiceSeed || randomSeed() : '';
    game = null;
    target = null;
    guesses = [];
    input.value = '';
    ac.close();
    history.replaceState(null, '', gameUrl());
    render();

    let loaded: Game;
    try {
        loaded = await loadGame(version, gameId);
    } catch (err) {
        if (token === loadToken) footer.textContent = 'Could not load the game data. Check your connection and reload.';
        console.error(err);
        return;
    }
    if (token !== loadToken) return;

    game = loaded;
    if (mode === 'daily') {
        dateKey = todayKey();
        target = dailyTarget(loaded, dateKey);
        guesses = loadDaily(loaded);
    } else {
        target = seededTarget(loaded, seed);
    }
    if (debug) console.log(`[geardle] ${version} ${gameId} target:`, target.displayName);
    renderHeader(loaded);
    render();
    if (!input.disabled) input.focus();
}

function switchTo(newVersion: Version, newGame: GameId) {
    if (newVersion === version && newGame === gameId) return;
    version = newVersion;
    gameId = newGame;
    startGame(mode);
}

function guess(item: Item) {
    if (!game || isOver() || guesses.includes(item)) return;
    guesses.push(item);
    saveDaily();
    render();
}

const ac = setupAutocomplete({
    input,
    list: suggestions,
    getItems: () => game?.items ?? [],
    isExcluded: (item) => guesses.includes(item),
    onSelect: guess,
});

versionTabs.forEach((t) => t.addEventListener('click', () => switchTo(t.dataset.version as Version, gameId)));
gameTabs.forEach((t) => t.addEventListener('click', () => switchTo(version, t.dataset.game as GameId)));
modeTabs.forEach((t) => t.addEventListener('click', () => startGame(t.dataset.mode as Mode)));
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

const initialSeed = normalizeSeed(params.get('seed') ?? '');
if (initialSeed) startGame('practice', initialSeed);
else startGame('daily');
