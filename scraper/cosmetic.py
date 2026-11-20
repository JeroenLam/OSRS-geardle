"""Find cosmetic-only copies of gear, e.g. "Rune platebody (g)" or "Zamorak platebody".

An item only counts as a cosmetic copy when its stats are identical to the
plain item it copies; anything with different stats or effects is kept.
Enchanted (e), imbued (i), charged and poisoned versions are never matched,
because their suffixes are not in COSMETIC_SUFFIXES.
"""

import re
from collections import defaultdict

GODS = ["ancient", "armadyl", "bandos", "guthix", "saradomin", "zamorak", "zaros", "seren", "armadyl"]

COLOURS = [
    "black", "blue", "brown", "cyan", "gold", "green", "grey", "gray", "orange", "pink",
    "purple", "red", "teal", "turquoise", "white", "yellow",
]

# Lower-case suffixes in "Name (suffix)" or "Name#suffix" that mark a recolour / trim / ornament.
COSMETIC_SUFFIXES = {
    "g", "t", "or", "r", "h1", "h2", "h3", "h4", "h5", "gilded", "gold", "trimmed", "trim",
    "ornament", "ornament kit", "unranked", *COLOURS, *GODS,
}

# Name prefixes for treasure-trail style renames of a regular item, e.g. "Gilded platebody"
# or "Saradomin full helm" (same stats as "Rune platebody" / "Rune full helm").
COSMETIC_PREFIXES = {"gilded", *GODS}

# A renamed item only counts as a copy of a plain material item. This keeps distinct god items
# that merely share stats with each other (halos, blessings, robes) in the game.
MATERIALS = {
    "bronze", "iron", "steel", "black", "white", "mithril", "adamant", "rune", "dragon", "dragonstone",
    "green", "blue", "red", "leather", "studded",
}

_SUFFIX = re.compile(r"^(?P<base>.*?)\s*(?:#(?P<version>.+)|\((?P<paren>[^()]+)\))$")


def _split(name: str) -> tuple[str, str] | None:
    """'Rune platebody (g)' -> ('Rune platebody', 'g'); 'Agility cape#Trimmed' -> ('Agility cape', 'trimmed')."""
    match = _SUFFIX.match(name)
    if not match:
        return None
    suffix = match.group("version") or match.group("paren")
    return match.group("base").strip(), suffix.strip().strip("()").lower()


def cosmetic_copies(rows: list[dict], stat_keys: list[str], name_key: str = "name") -> dict[str, str]:
    """Return {cosmetic item name: the item it copies} for rows whose stats match a plain item."""
    stats = {r[name_key]: tuple(str(r.get(k, "")).strip() for k in stat_keys) for r in rows}
    removed: dict[str, str] = {}

    # 1. Suffix copies: "X (g)" / "X#Trimmed" with the same stats as "X" or another non-cosmetic "X#..."
    by_base: dict[str, list[str]] = defaultdict(list)
    for name in stats:
        split = _split(name)
        by_base[split[0] if split else name].append(name)
    for base, names in by_base.items():
        plain = [n for n in names if not ((s := _split(n)) and s[1] in COSMETIC_SUFFIXES)]
        if base in stats and base not in plain:
            plain.append(base)
        for name in names:
            split = _split(name)
            if not split or split[1] not in COSMETIC_SUFFIXES or name in plain:
                continue
            original = next((p for p in plain if p != name and stats[p] == stats[name]), None)
            if original:
                removed[name] = original

    # 2. Prefix renames: "Zamorak platebody" with the same stats as a plain "... platebody"
    by_rest: dict[str, list[str]] = defaultdict(list)
    for name in stats:
        words = name.split(" ", 1)
        if len(words) == 2:
            by_rest[words[1].lower()].append(name)
    for rest, names in by_rest.items():
        plain = [n for n in names if n.split(" ", 1)[0].lower() in MATERIALS and n not in removed]
        for name in names:
            if name.split(" ", 1)[0].lower() not in COSMETIC_PREFIXES or name in removed:
                continue
            original = next((p for p in plain if stats[p] == stats[name]), None)
            if original:
                removed[name] = original
    return removed
