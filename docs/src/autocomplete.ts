import type { Item } from './data';

const MAX_RESULTS = 15;

export interface AutocompleteOptions {
  input: HTMLInputElement;
  list: HTMLUListElement;
  items: Item[];
  isExcluded: (item: Item) => boolean;
  onSelect: (item: Item) => void;
}

export function setupAutocomplete(opts: AutocompleteOptions): { close: () => void } {
  const { input, list, items, isExcluded, onSelect } = opts;
  let matches: Item[] = [];
  let active = -1;

  function close() {
    list.hidden = true;
    list.replaceChildren();
    matches = [];
    active = -1;
  }

  function highlight(index: number) {
    active = index;
    Array.from(list.children).forEach((el, i) => el.classList.toggle('active', i === active));
    list.children[active]?.scrollIntoView({ block: 'nearest' });
  }

  function choose(item: Item) {
    input.value = '';
    close();
    onSelect(item);
  }

  function render() {
    const query = input.value.trim().toLowerCase();
    if (!query) return close();

    const starts: Item[] = [];
    const contains: Item[] = [];
    for (const item of items) {
      if (isExcluded(item)) continue;
      const name = item.displayName.toLowerCase();
      if (name.startsWith(query)) starts.push(item);
      else if (name.includes(query)) contains.push(item);
    }
    matches = [...starts, ...contains].slice(0, MAX_RESULTS);

    list.replaceChildren(
      ...matches.map((item, i) => {
        const li = document.createElement('li');
        const img = document.createElement('img');
        img.src = item.image;
        img.alt = '';
        img.loading = 'lazy';
        const span = document.createElement('span');
        span.textContent = item.displayName;
        li.append(img, span);
        li.addEventListener('mousedown', (e) => {
          e.preventDefault();
          choose(item);
        });
        li.addEventListener('mouseenter', () => highlight(i));
        return li;
      }),
    );
    list.hidden = matches.length === 0;
    active = matches.length ? 0 : -1;
    highlight(active);
  }

  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && matches.length) {
      e.preventDefault();
      highlight((active + 1) % matches.length);
    } else if (e.key === 'ArrowUp' && matches.length) {
      e.preventDefault();
      highlight((active - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const exact = items.find(
        (it) => !isExcluded(it) && it.displayName.toLowerCase() === input.value.trim().toLowerCase(),
      );
      const pick = matches[active] ?? exact;
      if (pick) choose(pick);
    } else if (e.key === 'Escape') {
      close();
    }
  });

  return { close };
}
