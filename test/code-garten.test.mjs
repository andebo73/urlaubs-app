// Reine Logik-Tests für Code-Garten (kein Browser).
// Ausführen: node --test test/code-garten.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GameState } from '../code-garten/src/logic/gamestate.js';
import { CODES, EXAMPLE_CODES, normalizeCode, codeItemId } from '../code-garten/src/logic/codes.js';
import { ITEMS, RARITIES } from '../code-garten/src/logic/items.js';
import { World, FIELD, TREES } from '../code-garten/src/logic/world.js';

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

test('Vorwärtsgehen bewegt den Avatar in Blickrichtung', () => {
  const w = new World();
  w.yaw = 0; // Blick nach +Z
  const z0 = w.z;
  for (let i = 0; i < 10; i++) w.update(0.1, { move: 1 });
  assert.ok(w.z > z0, 'sollte sich in +Z bewegen');
  assert.ok(Math.abs(w.x) < 0.01, 'ohne Strafe keine seitliche Bewegung');
});

test('Rückwärtsgehen kehrt die Richtung um', () => {
  const w = new World();
  w.yaw = 0;
  const z0 = w.z;
  w.update(0.1, { move: -1 });
  assert.ok(w.z < z0);
});

test('Strafe bewegt seitlich', () => {
  const w = new World();
  w.yaw = 0;
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

test('Avatar bleibt im Feld', () => {
  const w = new World();
  w.yaw = 0;
  for (let i = 0; i < 200; i++) w.update(0.2, { move: 1 });
  assert.ok(w.z <= FIELD - 1 + 1e-6, 'nicht über die Feldgrenze hinaus');
});

test('Bäume blockieren (Kollision hält Abstand)', () => {
  const w = new World();
  const tree = TREES[0];
  // Direkt neben den Baum setzen und hineinlaufen.
  w.x = tree.x - 3;
  w.z = tree.z;
  w.yaw = Math.PI / 2; // Blick nach +X (auf den Baum zu)
  for (let i = 0; i < 40; i++) w.update(0.1, { move: 1 });
  const d = Math.hypot(w.x - tree.x, w.z - tree.z);
  assert.ok(d >= 1.1, `Abstand zum Baum zu klein: ${d.toFixed(2)}`);
});

test('moving-Flag spiegelt Bewegung', () => {
  const w = new World();
  w.update(0.1, { move: 1 });
  assert.equal(w.moving, true);
  w.update(0.1, {});
  assert.equal(w.moving, false);
});
