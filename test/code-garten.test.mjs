// Reine Logik-Tests für Code-Garten (kein Browser).
// Ausführen: node --test test/code-garten.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GameState } from '../code-garten/src/logic/gamestate.js';
import { CODES, EXAMPLE_CODES, normalizeCode, codeItemId } from '../code-garten/src/logic/codes.js';
import { ITEMS, RARITIES } from '../code-garten/src/logic/items.js';
import { World, FIELD, TREES, FOUNTAIN, RESPAWN_POINTS } from '../code-garten/src/logic/world.js';

test('normalizeCode ist tolerant (trim, Groß, Leerzeichen)', () => {
  assert.equal(normalizeCode('  woof '), 'WOOF');
  assert.equal(normalizeCode('ni nja'), 'NINJA');
  assert.equal(normalizeCode(null), '');
});

test('jeder Code verweist auf ein existierendes Item', () => {
  for (const [code, itemId] of Object.entries(CODES)) {
    assert.ok(ITEMS[itemId], `Code ${code} zeigt auf unbekanntes Item ${itemId}`);
  }
});

test('jedes Item hat eine gültige Seltenheit', () => {
  for (const [id, it] of Object.entries(ITEMS)) {
    assert.ok(RARITIES[it.rarity], `Item ${id} hat ungültige Seltenheit ${it.rarity}`);
    assert.ok(it.emoji && it.name, `Item ${id} unvollständig`);
  }
});

test('Beispielcodes existieren alle im Katalog', () => {
  for (const c of EXAMPLE_CODES) {
    assert.ok(CODES[c], `Beispielcode ${c} fehlt im Katalog`);
  }
});

test('gültigen Code einlösen liefert das Item', () => {
  const gs = new GameState();
  const r = gs.redeem('WILLKOMMEN');
  assert.equal(r.ok, true);
  assert.equal(r.itemId, 'stern');
  assert.equal(r.item.name, 'Superstar');
  assert.equal(gs.totalItems(), 1);
  assert.ok(gs.has('stern'));
});

test('Code ist tolerant gegenüber Klein-/Leerzeichen', () => {
  const gs = new GameState();
  const r = gs.redeem('  woof ');
  assert.equal(r.ok, true);
  assert.equal(r.itemId, 'haustier_hund');
});

test('leere Eingabe wird abgewiesen', () => {
  const gs = new GameState();
  assert.equal(gs.redeem('   ').reason, 'empty');
  assert.equal(gs.totalItems(), 0);
});

test('unbekannter Code wird abgewiesen', () => {
  const gs = new GameState();
  const r = gs.redeem('GIBTESNICHT');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown');
  assert.equal(gs.totalItems(), 0);
});

test('derselbe Code lässt sich nur einmal einlösen', () => {
  const gs = new GameState();
  assert.equal(gs.redeem('KRONE').ok, true);
  const again = gs.redeem('krone');
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'used');
  assert.equal(gs.count('krone'), 1);
});

test('mehrere verschiedene Codes summieren sich', () => {
  const gs = new GameState();
  gs.redeem('WILLKOMMEN');
  gs.redeem('NINJA');
  gs.redeem('DIAMANT');
  assert.equal(gs.totalItems(), 3);
  assert.equal(gs.distinctItems(), 3);
});

test('Inventar ist nach Seltenheit sortiert (selten zuerst)', () => {
  const gs = new GameState();
  gs.redeem('WILLKOMMEN'); // stern – gewöhnlich
  gs.redeem('DIAMANT');    // diamant – legendär
  gs.redeem('NINJA');      // schwert – episch
  const order = gs.list().map((i) => i.rarity);
  assert.deepEqual(order, ['legendär', 'episch', 'gewöhnlich']);
});

test('reset leert Inventar und Code-Historie', () => {
  const gs = new GameState();
  gs.redeem('KRONE');
  gs.reset();
  assert.equal(gs.totalItems(), 0);
  // Nach reset ist der Code wieder einlösbar.
  assert.equal(gs.redeem('KRONE').ok, true);
});

test('codeItemId liefert Item-Id oder null', () => {
  assert.equal(codeItemId('TURBO'), 'turbo_schuhe');
  assert.equal(codeItemId('bla'), null);
});

test('snapshot enthält Summe und Item-Liste', () => {
  const gs = new GameState();
  gs.redeem('WILLKOMMEN');
  const s = gs.snapshot();
  assert.equal(s.total, 1);
  assert.equal(s.items.length, 1);
  assert.equal(s.lastItemId, 'stern');
});

// --- Begehbare Welt --------------------------------------------------------

// Setzt den Avatar an eine bekannte Stelle (abseits von Brunnen/Bäumen).
function at(w, x, z, yaw = 0) {
  w.x = x;
  w.z = z;
  w.y = 0;
  w.vy = 0;
  w.grounded = true;
  w.yaw = yaw;
}

test('startet an einem Respawn-Punkt am Brunnen', () => {
  const w = new World();
  const d = Math.hypot(w.x, w.z);
  assert.ok(d > FOUNTAIN.r, 'nicht im Brunnen');
  assert.ok(Math.abs(d - 7) < 0.01, 'auf dem Respawn-Ring');
  assert.equal(w.grounded, true);
});

test('Vorwärtsgehen bewegt den Avatar in Blickrichtung', () => {
  const w = new World();
  at(w, 0, -12, 0); // Blick nach +Z
  const z0 = w.z;
  for (let i = 0; i < 10; i++) w.update(0.1, { move: 1 });
  assert.ok(w.z > z0, 'sollte sich in +Z bewegen');
  assert.ok(Math.abs(w.x) < 0.01, 'ohne Strafe keine seitliche Bewegung');
});

test('Rückwärtsgehen kehrt die Richtung um', () => {
  const w = new World();
  at(w, 0, 0, 0);
  w.z = 12;
  const z0 = w.z;
  w.update(0.1, { move: -1 });
  assert.ok(w.z < z0);
});

test('Strafe bewegt seitlich', () => {
  const w = new World();
  at(w, 0, -12, 0);
  const x0 = w.x;
  w.update(0.1, { strafe: 1 });
  assert.ok(w.x > x0, 'Strafe rechts erhöht X');
});

test('Drehen verändert die Blickrichtung', () => {
  const w = new World();
  const y0 = w.yaw;
  w.update(0.1, { turn: 1 });
  assert.ok(w.yaw > y0);
  w.applyTurn(0.5);
  assert.ok(Math.abs(w.yaw - (y0 + 0.5)) > 0);
});

test('Bäume blockieren (Kollision hält Abstand)', () => {
  const w = new World();
  const tree = TREES[0];
  at(w, tree.x - 3, tree.z, Math.PI / 2); // Blick auf den Baum zu (+X)
  for (let i = 0; i < 40; i++) w.update(0.1, { move: 1 });
  const d = Math.hypot(w.x - tree.x, w.z - tree.z);
  assert.ok(d >= 1.1, `Abstand zum Baum zu klein: ${d.toFixed(2)}`);
});

test('Brunnen blockiert (man läuft nicht hindurch)', () => {
  const w = new World();
  at(w, FOUNTAIN.r + 2, 0, -Math.PI / 2); // Blick zum Brunnen (-X)
  for (let i = 0; i < 30; i++) w.update(0.1, { move: 1 });
  const d = Math.hypot(w.x - FOUNTAIN.x, w.z - FOUNTAIN.z);
  assert.ok(d >= FOUNTAIN.r, `im Brunnen gelandet: ${d.toFixed(2)}`);
});

test('moving-Flag spiegelt Bewegung', () => {
  const w = new World();
  at(w, 0, -12, 0);
  w.update(0.1, { move: 1 });
  assert.equal(w.moving, true);
  w.update(0.1, {});
  assert.equal(w.moving, false);
});

// --- Springen & Fallen -----------------------------------------------------

test('Springen hebt den Avatar an und er landet wieder', () => {
  const w = new World();
  at(w, 0, -12, 0);
  w.update(0.05, { jump: true });
  assert.ok(!w.grounded, 'nach dem Absprung in der Luft');
  let maxY = 0;
  for (let i = 0; i < 40; i++) {
    w.update(0.05, {});
    maxY = Math.max(maxY, w.y);
  }
  assert.ok(maxY > 2, `Sprunghöhe zu gering: ${maxY.toFixed(2)}`);
  assert.equal(w.grounded, true, 'landet wieder auf der Plattform');
  assert.ok(Math.abs(w.y) < 0.01, 'steht wieder bei y=0');
});

test('kein Doppelsprung in der Luft', () => {
  const w = new World();
  at(w, 0, -12, 0);
  w.update(0.05, { jump: true });
  const vyAfterJump = w.vy;
  w.update(0.05, { jump: true }); // zweiter Sprung ignoriert
  assert.ok(w.vy < vyAfterJump, 'Schwerkraft wirkt, kein erneuter Schub');
});

test('von der Plattform fallen führt zum Respawn am Brunnen', () => {
  const w = new World();
  // Direkt neben die Kante setzen und hinauslaufen.
  at(w, FIELD - 0.5, 0, Math.PI / 2); // Blick nach +X (über die Kante)
  const before = w.respawnCount;
  let fellBelowZero = false;
  for (let i = 0; i < 120; i++) {
    w.update(0.05, { move: 1 });
    if (w.y < -1) fellBelowZero = true;
    if (w.respawnCount > before) break;
  }
  assert.ok(fellBelowZero, 'sollte zwischendurch gefallen sein');
  assert.equal(w.respawnCount, before + 1, 'genau ein Respawn');
  assert.ok(w.onPlatform(), 'wieder auf der Plattform');
  assert.equal(w.grounded, true);
  const d = Math.hypot(w.x, w.z);
  assert.ok(Math.abs(d - 7) < 0.01, 'auf dem Respawn-Ring gelandet');
});

test('Respawn nutzt der Reihe nach die Ringpunkte', () => {
  const w = new World();
  w.respawn();
  const p1 = { x: w.x, z: w.z };
  w.respawn();
  const p2 = { x: w.x, z: w.z };
  assert.ok(p1.x !== p2.x || p1.z !== p2.z, 'unterschiedliche Respawn-Punkte');
  // Beide liegen auf dem Ring.
  for (const p of [p1, p2]) assert.ok(Math.abs(Math.hypot(p.x, p.z) - 7) < 0.01);
});

test('onPlatform erkennt das Verlassen der Plattform', () => {
  const w = new World();
  assert.equal(w.onPlatform(0, 0), true);
  assert.equal(w.onPlatform(FIELD + 2, 0), false);
});
