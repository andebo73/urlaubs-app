// Reine Logik-Tests (kein Browser). Ausführen: node --test test/logic.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Rng } from '../src/logic/rng.js';
import { generateMaze, isFullyConnected } from '../src/logic/maze.js';
import { Player } from '../src/logic/player.js';
import { Inventory } from '../src/logic/inventory.js';
import { GameState } from '../src/logic/gamestate.js';
import { viertelAt, paintWalls, VIERTEL } from '../src/logic/viertel.js';
import { MAX_LEVEL, RESOURCES_PER_LEVEL, getClass } from '../src/logic/classes.js';

test('Rng ist deterministisch für gleichen Seed', () => {
  const a = new Rng(42);
  const b = new Rng(42);
  for (let i = 0; i < 100; i++) assert.equal(a.float(), b.float());
});

test('Labyrinth ist vollständig zusammenhängend', () => {
  for (const seed of [1, 2, 12345, 99999]) {
    const grid = generateMaze(new Rng(seed), 10, 10);
    assert.ok(isFullyConnected(grid), `Seed ${seed} nicht zusammenhängend`);
  }
});

test('Viertel: vier Ecken ergeben vier verschiedene Viertel', () => {
  const grid = generateMaze(new Rng(7), 10, 10);
  const w = grid.width, h = grid.height;
  assert.equal(viertelAt(grid, 1, 1), 'handel');
  assert.equal(viertelAt(grid, w - 2, 1), 'pilz');
  assert.equal(viertelAt(grid, 1, h - 2), 'katakomben');
  assert.equal(viertelAt(grid, w - 2, h - 2), 'mechanik');
});

test('paintWalls setzt Wand-Textur-IDs gemäß Viertel', () => {
  const grid = generateMaze(new Rng(7), 10, 10);
  paintWalls(grid);
  // Eine Wandzelle oben-links muss die Handelsviertel-Textur (1) tragen.
  let found = false;
  for (let y = 0; y < grid.height / 2 && !found; y++) {
    for (let x = 0; x < grid.width / 2 && !found; x++) {
      if (grid.get(x, y) > 0) {
        assert.equal(grid.get(x, y), VIERTEL.handel.wall);
        found = true;
      }
    }
  }
  assert.ok(found, 'keine Wand im Handelsviertel gefunden');
});

test('Klassen haben unterschiedliche Startwerte', () => {
  const k = new Player('kaempfer');
  const m = new Player('magier');
  assert.equal(k.strength, 4);
  assert.equal(k.maxHp, 26);
  assert.equal(m.maxHp, 18);
  assert.equal(k.resource, 'erz');
  assert.equal(m.resource, 'rune');
});

test('Inventar zählt Rohstoffe', () => {
  const inv = new Inventory();
  inv.add('erz', 3);
  inv.add('rune');
  assert.equal(inv.count('erz'), 3);
  assert.equal(inv.total(), 4);
  assert.equal(inv.list().length, 4);
});

test('Aufstieg durch Abgeben von 5 Gilden-Rohstoffen', () => {
  const gs = new GameState(777);
  gs.chooseClass('kaempfer');
  assert.equal(gs.player.level, 1);
  gs.inventory.add(gs.player.resource, RESOURCES_PER_LEVEL);
  const r = gs.tradeAndHandIn();
  assert.equal(r.type, 'levelup');
  assert.equal(gs.player.level, 2);
  assert.equal(gs.inventory.count(gs.player.resource), 0);
});

test('Händler tauscht 2 fremde in 1 eigenen Rohstoff', () => {
  const gs = new GameState(778);
  gs.chooseClass('kaempfer'); // Gilde: erz
  gs.inventory.add('rune', 10); // 10 fremde -> 5 erz -> 1 Aufstieg
  const r = gs.tradeAndHandIn();
  assert.equal(r.type, 'levelup');
  assert.equal(gs.player.level, 2);
});

test('Kampf gibt einen Rohstoff (Beute)', () => {
  const gs = new GameState(555);
  gs.chooseClass('kaempfer');
  const before = gs.inventory.total();
  const enemy = gs.enemies[0];
  gs.startCombat(enemy);
  let guard = 0;
  while (gs.mode === 'combat' && guard++ < 100 && gs.player.isAlive()) gs.attack();
  assert.equal(enemy.alive, false);
  assert.ok(gs.inventory.total() > before, 'Beute-Rohstoff sollte gutgeschrieben werden');
});

test('Genug Aufstiege führen zur Meister-Stufe (Sieg)', () => {
  const gs = new GameState(2024);
  gs.chooseClass('heiler');
  for (let lvl = 1; lvl < MAX_LEVEL; lvl++) {
    gs.inventory.add(gs.player.resource, RESOURCES_PER_LEVEL);
    gs.tradeAndHandIn();
  }
  assert.equal(gs.player.level, MAX_LEVEL);
  assert.equal(gs.player.isMaster(), true);
  assert.equal(gs.mode, 'win');
});

test('Bewegung betritt keine Wandzelle', () => {
  const gs = new GameState(999);
  gs.chooseClass('schurke');
  const rng = new Rng(1);
  for (let i = 0; i < 300; i++) {
    const d = rng.int(0, 3);
    if (d === 0) gs.moveForward(1);
    else if (d === 1) gs.moveForward(-1);
    else if (d === 2) gs.strafe(1);
    else gs.turn(1);
    assert.ok(!gs.grid.isWallAt(gs.player.x, gs.player.y), 'Spieler in Wand!');
  }
});

test('Startet im Klassenwahl-Modus', () => {
  const gs = new GameState(1);
  assert.equal(gs.mode, 'classselect');
  gs.chooseClass('magier');
  assert.equal(gs.mode, 'explore');
  assert.equal(getClass('magier').name, 'Magier');
});
