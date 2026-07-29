// Erzeugt und platziert Gegner (Kobolde), Rohstoffe und den Händler.
// Reine Logik: nutzt Rng, kein DOM.

import { RESOURCE_IDS } from './classes.js';
import { viertelAt, isDanger } from './viertel.js';
import { isFullyConnected } from './maze.js';

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

export function makeBewohner(x, y) {
  return {
    kind: 'bewohner',
    id: nextId(),
    name: 'Bewohner',
    sprite: 'bewohner',
    x: x + 0.5,
    y: y + 0.5,
  };
}

export function makeKey(x, y) {
  return { kind: 'key', id: nextId(), sprite: 'key', x: x + 0.5, y: y + 0.5, collected: false };
}

export function makeChest(rng, x, y) {
  const resId = RESOURCE_IDS[rng.int(0, RESOURCE_IDS.length - 1)];
  return {
    kind: 'chest',
    id: nextId(),
    x: x + 0.5,
    y: y + 0.5,
    opened: false,
    loot: { resId, amount: 3 },
  };
}

// Sichere Tür-Zellen finden: freie Korridorzellen (>=2 freie Nachbarn), deren
// Schließen die übrigen freien Zellen NICHT trennt (Nicht-Schnittpunkte).
// So kann eine Tür nie einen Pflichtweg blockieren – sie ist immer nur Abkürzung.
export function findDoorCells(grid, rng, count, avoid, freeCells) {
  const out = [];
  const shuffled = freeCells.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Kumulativ prüfen: bereits akzeptierte Türen bleiben in `work` geschlossen,
  // damit auch Kombinationen von Türen keinen Pflichtweg trennen können.
  const work = grid.clone();
  for (const c of shuffled) {
    if (out.length >= count) break;
    if (avoid.has(`${c.x},${c.y}`)) continue;
    if (work.freeNeighbourCount(c.x, c.y) < 2) continue;
    work.set(c.x, c.y, 1); // Tür geschlossen simulieren
    if (isFullyConnected(work)) {
      out.push({ x: c.x, y: c.y });
      avoid.add(`${c.x},${c.y}`);
    } else {
      work.set(c.x, c.y, 0); // zurücknehmen – diese Zelle wäre ein Schnittpunkt
    }
  }
  return out;
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

  // Bewohner (Auftraggeber) im Handelsviertel, nahe Start.
  const bewCells = handelCells.filter((c) => !taken.has(key(c)));
  const bCell = (bewCells.length ? shuffle(bewCells) : free.filter((c) => !taken.has(key(c))))[0] || start;
  const bewohner = makeBewohner(bCell.x, bCell.y);
  taken.add(key(bCell));

  // Truhen an Sackgassen (genau ein freier Nachbar) – lohnende Ecken.
  const deadEnds = shuffle(
    free.filter((c) => !taken.has(key(c)) && grid.freeNeighbourCount(c.x, c.y) === 1)
  );
  const chests = [];
  for (let i = 0; i < (opts.chestCount ?? 3) && i < deadEnds.length; i++) {
    const c = deadEnds[i];
    taken.add(key(c));
    chests.push(makeChest(rng, c.x, c.y));
  }

  // Schlüssel als Aufsammel-Gegenstände.
  const keyCells = shuffle(free.filter((c) => !taken.has(key(c))));
  const keys = [];
  for (let i = 0; i < (opts.keyCount ?? 3) && i < keyCells.length; i++) {
    const c = keyCells[i];
    taken.add(key(c));
    keys.push(makeKey(c.x, c.y));
  }

  // Sichere Türen (Abkürzungen), die nie einen Pflichtweg blockieren.
  const doors = findDoorCells(grid, rng, opts.doorCount ?? 4, taken, free);

  // Rohstoffe über alle Viertel verteilen, Farbe zufällig.
  const resCells = shuffle(free.filter((c) => !taken.has(key(c))));
  const resources = [];
  for (let i = 0; i < resourceCount && i < resCells.length; i++) {
    const c = resCells[i];
    taken.add(key(c));
    const resId = RESOURCE_IDS[rng.int(0, RESOURCE_IDS.length - 1)];
    resources.push(makeResource(resId, c.x, c.y));
  }

  return { enemies, resources, haendler, bewohner, keys, chests, doors };
}
