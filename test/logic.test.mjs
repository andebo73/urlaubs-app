// Reine Logik-Tests (kein Browser). Ausführen: node --test test/logic.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Rng } from '../src/logic/rng.js';
import { generateMaze, isFullyConnected } from '../src/logic/maze.js';
import { Player, xpToNext } from '../src/logic/player.js';
import { GameState } from '../src/logic/gamestate.js';
import { playerAttack } from '../src/logic/combat.js';

test('Rng ist deterministisch für gleichen Seed', () => {
  const a = new Rng(42);
  const b = new Rng(42);
  for (let i = 0; i < 100; i++) assert.equal(a.float(), b.float());
  const c = new Rng(43);
  assert.notEqual(new Rng(42).float(), c.float());
});

test('Labyrinth ist vollständig zusammenhängend', () => {
  for (const seed of [1, 2, 12345, 99999]) {
    const grid = generateMaze(new Rng(seed), 10, 10);
    assert.ok(isFullyConnected(grid), `Seed ${seed} nicht zusammenhängend`);
  }
});

test('XP-Kurve steigt monoton', () => {
  for (let l = 1; l < 20; l++) assert.ok(xpToNext(l + 1) > xpToNext(l));
});

test('Spieler steigt bei genug XP auf', () => {
  const p = new Player();
  const before = { level: p.level, maxHp: p.maxHp, strength: p.strength };
  const need = p.xpToNext;
  const res = p.addXp(need + 5);
  assert.ok(res.leveledUp);
  assert.equal(p.level, before.level + 1);
  assert.ok(p.maxHp > before.maxHp);
  assert.ok(p.strength > before.strength);
  assert.equal(p.xp, 5);
});

test('Bewegung betritt keine Wandzelle', () => {
  const gs = new GameState(777);
  // 300 zufällige Bewegungen; nie in einer Wand landen.
  const dirs = ['f', 'b', 's', 'r'];
  const rng = new Rng(1);
  for (let i = 0; i < 300; i++) {
    const d = rng.pick(dirs);
    if (d === 'f') gs.moveForward(1);
    else if (d === 'b') gs.moveForward(-1);
    else if (d === 's') gs.strafe(1);
    else gs.turn(1);
    assert.ok(!gs.grid.isWallAt(gs.player.x, gs.player.y), 'Spieler in Wand!');
  }
});

test('Kampf reduziert Gegner-HP und vergibt XP', () => {
  const gs = new GameState(555);
  const enemy = gs.enemies[0];
  const startHp = enemy.hp;
  const rng = new Rng(9);
  const r1 = playerAttack(rng, gs.player, enemy);
  assert.ok(r1.damageDealt > 0);
  assert.ok(enemy.hp < startHp);
  // Bis zum Sieg weiterschlagen.
  let guard = 0;
  let defeated = r1.enemyDefeated;
  let totalXp = r1.xpGained;
  while (!defeated && guard++ < 100 && gs.player.isAlive()) {
    const r = playerAttack(rng, gs.player, enemy);
    defeated = r.enemyDefeated;
    totalXp += r.xpGained;
  }
  assert.ok(defeated, 'Gegner sollte irgendwann besiegt sein');
  assert.ok(totalXp > 0, 'XP sollte vergeben werden');
});

test('Alle Karten sammeln führt zu Sieg', () => {
  const gs = new GameState(2024);
  const total = gs.cards.length;
  assert.ok(total > 0);
  for (const c of [...gs.cards]) gs.pickup(c);
  assert.equal(gs.mode, 'win');
  assert.equal(gs.inventory.uniqueCount() > 0, true);
});
