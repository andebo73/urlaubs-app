// Reine Logik-Tests für Code-Garten (kein Browser).
// Ausführen: node --test test/code-garten.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GameState } from '../code-garten/src/logic/gamestate.js';
import { CODES, EXAMPLE_CODES, normalizeCode, codeItemId } from '../code-garten/src/logic/codes.js';
import { ITEMS, RARITIES } from '../code-garten/src/logic/items.js';

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
