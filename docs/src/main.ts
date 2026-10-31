import './style.css';
import { COLUMNS, ITEMS, type Column, type Item, type Value } from './data';
import { compareItems, dailyTarget, randomTarget, todayKey, type Result } from './game';
import { setupAutocomplete } from './autocomplete';

type Mode = 'daily' | 'practice';

const input = document.querySelector<HTMLInputElement>('#guess-input')!;
const suggestions = document.querySelector<HTMLUListElement>('#suggestions')!;
const thead = document.querySelector<HTMLTableSectionElement>('#guesses thead')!;
const tbody = document.querySelector<HTMLTableSectionElement>('#guesses tbody')!;
const banner = document.querySelector<HTMLDivElement>('#banner')!;
const newGameBtn = document.querySelector<HTMLButtonElement>('#new-game')!;
const giveUpBtn = document.querySelector<HTMLButtonElement>('#give-up')!;
const footer = document.querySelector<HTMLElement>('#footer')!;
const tabs = document.querySelectorAll<HTMLButtonElement>('.tab');

const debug = new URLSearchParams(location.search).has('debug');
const itemsByName = new Map(ITEMS.map((it) => [it.name, it]));

let mode: Mode = 'daily';
let dateKey = todayKey();
let target: Item = dailyTarget(dateKey);
let guesses: Item[] = [];
let gaveUp = false;

const storageKey = () => `geardle-daily-${dateKey}`;

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
    return names.map((n) => itemsByName.get(String(n))).filter((x): x is Item => !!x);
  } catch {
    return [];
  }
}

function formatValue(col: Column, v: Value): string {
  if (v === null || v === '') return '—';
  if (col.key === 'is_member') return v === 'True' ? 'Yes' : 'No';
  if (col.key === 'equipment_slot') return String(v).replace(/_/g, ' ');
  if (typeof v !== 'number') return String(v);
  if (col.key === 'weight') return v.toFixed(3);
  if (col.key === 'attack_speed') return String(v);
  return `${v > 0 ? '+' : ''}${v}${col.suffix ?? ''}`;
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
  tr.append(th(''), th('Item'), ...COLUMNS.map((c) => th(c.label, c.title)));
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
  const results = compareItems(item, target);
  const tr = document.createElement('tr');
  if (item === target) tr.classList.add('correct');
  tr.append(...itemCell(item));
  COLUMNS.forEach((col, i) => {
    const td = document.createElement('td');
    td.className = `cell ${results[i]}`;
    td.title = col.title;
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
    ? `You got it in ${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}! The item was ${target.displayName}.`
    : `The item was ${target.displayName}.`;
  if (won && mode === 'daily') text.textContent += ' Come back tomorrow for a new one.';
  banner.className = `banner ${won ? 'won' : 'lost'}`;
  banner.replaceChildren(img, text);
  banner.hidden = false;
}

function render() {
  tbody.replaceChildren(...[...guesses].reverse().map(renderRow));
  renderBanner();
  const over = isOver();
  input.disabled = over;
  input.placeholder = over ? 'Game over' : 'Guess an item...';
  newGameBtn.hidden = mode !== 'practice';
  giveUpBtn.hidden = mode !== 'practice' || over;
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.mode === mode));
}

function startGame(newMode: Mode) {
  mode = newMode;
  gaveUp = false;
  if (mode === 'daily') {
    dateKey = todayKey();
    target = dailyTarget(dateKey);
    guesses = loadDaily();
  } else {
    target = randomTarget(target);
    guesses = [];
  }
  if (debug) console.log('[geardle] target:', target.displayName);
  input.value = '';
  ac.close();
  render();
  if (!input.disabled) input.focus();
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
  items: ITEMS,
  isExcluded: (item) => guesses.includes(item),
  onSelect: guess,
});

tabs.forEach((t) => t.addEventListener('click', () => startGame(t.dataset.mode as Mode)));
newGameBtn.addEventListener('click', () => startGame('practice'));
giveUpBtn.addEventListener('click', () => {
  gaveUp = true;
  render();
});

footer.textContent = `${ITEMS.length} items · Data from the Old School RuneScape Wiki`;
renderHeader();
startGame('daily');
