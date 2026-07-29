// Gegner (Kobolde) und Sammelkarten erzeugen und im Labyrinth platzieren.
// Reine Logik: nutzt Rng, kein DOM.

// Alle sammelbaren Karten (eigene Fantasie-Kreaturen, keine fremden Marken).
// Reihenfolge = feste ID-Zuordnung. sprite verweist auf einen Asset-Schlüssel.
export const CARD_DEFS = [
  { id: 'pilzkobold', name: 'Pilzkobold', rarity: 'gewöhnlich', sprite: 'card_pilz' },
  { id: 'moosgeist', name: 'Moosgeist', rarity: 'gewöhnlich', sprite: 'card_moos' },
  { id: 'funkenkäfer', name: 'Funkenkäfer', rarity: 'selten', sprite: 'card_funke' },
  { id: 'kristalldrache', name: 'Kristalldrache', rarity: 'selten', sprite: 'card_kristall' },
  { id: 'schattenwicht', name: 'Schattenwicht', rarity: 'episch', sprite: 'card_schatten' },
  { id: 'goldkönig', name: 'Goldkönig', rarity: 'legendär', sprite: 'card_gold' },
];

// Gegnertypen. Werte skalieren leicht mit der Labyrinth-Tiefe.
const ENEMY_TYPES = [
  { type: 'kobold', name: 'Kobold', baseHp: 8, strength: 2, xpReward: 6, sprite: 'goblin' },
  { type: 'wachkobold', name: 'Wachkobold', baseHp: 14, strength: 3, xpReward: 11, sprite: 'goblin_gross' },
];

let _uid = 0;
function nextId() {
  _uid += 1;
  return _uid;
}
export function resetEntityIds() {
  _uid = 0;
}

export function makeEnemy(rng, x, y) {
  const t = ENEMY_TYPES[rng.int(0, ENEMY_TYPES.length - 1)];
  const hp = t.baseHp + rng.int(0, 4);
  return {
    kind: 'enemy',
    id: nextId(),
    type: t.type,
    name: t.name,
    sprite: t.sprite,
    x: x + 0.5,
    y: y + 0.5,
    hp,
    maxHp: hp,
    strength: t.strength,
    xpReward: t.xpReward,
    alive: true,
  };
}

export function makeCard(def, x, y) {
  return {
    kind: 'card',
    id: nextId(),
    cardId: def.id,
    name: def.name,
    rarity: def.rarity,
    sprite: def.sprite,
    x: x + 0.5,
    y: y + 0.5,
    collected: false,
  };
}

// Platziert Gegner und Karten auf freien Zellen, hält Abstand zum Start.
// Gibt { enemies, cards } zurück.
export function populate(rng, grid, start, opts = {}) {
  const enemyCount = opts.enemyCount ?? 8;
  const cardCount = opts.cardCount ?? CARD_DEFS.length;

  const free = grid
    .freeCells()
    // Nicht direkt auf/neben dem Startfeld spawnen.
    .filter((c) => Math.abs(c.x - start.x) + Math.abs(c.y - start.y) > 2);

  // Freie Zellen deterministisch mischen (Fisher-Yates mit Rng).
  const pool = free.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  let idx = 0;
  const enemies = [];
  for (let i = 0; i < enemyCount && idx < pool.length; i++, idx++) {
    const cell = pool[idx];
    enemies.push(makeEnemy(rng, cell.x, cell.y));
  }

  const cards = [];
  for (let i = 0; i < cardCount && idx < pool.length; i++, idx++) {
    const cell = pool[idx];
    cards.push(makeCard(CARD_DEFS[i % CARD_DEFS.length], cell.x, cell.y));
  }

  return { enemies, cards };
}
