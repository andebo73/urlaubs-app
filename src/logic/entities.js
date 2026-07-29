// Erzeugt und platziert Gegner (Kobolde), Rohstoffe und den Händler.
// Reine Logik: nutzt Rng, kein DOM.

import { RESOURCE_IDS } from './classes.js';
import { viertelAt, VIERTEL, isDanger } from './viertel.js';

const ENEMY_TYPES = [
  { type: 'kobold', name: 'Kobold', baseHp: 8, strength: 2, sprite: 'goblin' },
  { type: 'wachkobold', name: 'Wachkobold', baseHp: 14, strength: 3, sprite: 'goblin_gross' },
];
// Für die Guide-Anzeige nach außen sichtbar.
export { ENEMY_TYPES };

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
    drop: RESOURCE_IDS[rng.int(0, RESOURCE_IDS.length - 1)], // Beute-Rohstoff
    alive: true,
  };
}

export function makeResource(resId, x, y) {
  return {
    kind: 'resource',
    id: nextId(),
    resId,
    sprite: 'res_' + resId,
    x: x + 0.5,
    y: y + 0.5,
    collected: false,
  };
}

export function makeHaendler(x, y) {
  return {
    kind: 'haendler',
    id: nextId(),
    name: 'Händler',
    sprite: 'haendler',
    x: x + 0.5,
    y: y + 0.5,
  };
}

// Platziert Händler (im Handelsviertel nahe Start), Rohstoffe (in allen Vierteln)
// und Gegner (nur in den gefährlichen Vierteln). Gibt { enemies, resources, haendler }.
export function populate(rng, grid, start, opts = {}) {
  const resourceCount = opts.resourceCount ?? 26;
  const enemyCount = opts.enemyCount ?? 9;

  const free = grid.freeCells();

  // Deterministisch mischen (Fisher-Yates).
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Händler: freie Zelle im Handelsviertel, etwas entfernt vom Start.
  const handelCells = free.filter(
    (c) => viertelAt(grid, c.x, c.y) === 'handel' &&
      Math.abs(c.x - start.x) + Math.abs(c.y - start.y) > 1
  );
  const hCell = (handelCells.length ? shuffle(handelCells) : free)[0] || start;
  const haendler = makeHaendler(hCell.x, hCell.y);

  const taken = new Set([`${hCell.x},${hCell.y}`, `${start.x},${start.y}`]);
  const key = (c) => `${c.x},${c.y}`;

  // Gegner nur in gefährlichen Vierteln.
  const dangerCells = shuffle(
    free.filter((c) => isDanger(viertelAt(grid, c.x, c.y)) && !taken.has(key(c)))
  );
  const enemies = [];
  for (let i = 0; i < enemyCount && i < dangerCells.length; i++) {
    const c = dangerCells[i];
    taken.add(key(c));
    enemies.push(makeEnemy(rng, c.x, c.y));
  }

  // Rohstoffe über alle Viertel verteilen, Farbe zufällig.
  const resCells = shuffle(free.filter((c) => !taken.has(key(c))));
  const resources = [];
  for (let i = 0; i < resourceCount && i < resCells.length; i++) {
    const c = resCells[i];
    taken.add(key(c));
    const resId = RESOURCE_IDS[rng.int(0, RESOURCE_IDS.length - 1)];
    resources.push(makeResource(resId, c.x, c.y));
  }

  return { enemies, resources, haendler };
}
