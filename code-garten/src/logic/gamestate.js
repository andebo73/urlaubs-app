// Spielzustand für Code-Garten: verwaltet das Inventar und schon eingelöste
// Codes. Reine Logik ohne DOM und ohne Zufall -> vollständig testbar.

import { CODES, EXAMPLE_CODES, normalizeCode } from './codes.js';
import { ITEMS, RARITIES } from './items.js';

export class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.inventory = new Map(); // itemId -> Anzahl
    this.used = new Set();      // bereits eingelöste (normalisierte) Codes
    this.lastItemId = null;     // zuletzt erhaltenes Item (für Effekte)
  }

  // Vollständiger Item-Eintrag (angereichert mit Farbe) oder null.
  _entry(id) {
    const it = ITEMS[id];
    if (!it) return null;
    return {
      id,
      name: it.name,
      emoji: it.emoji,
      rarity: it.rarity,
      color: RARITIES[it.rarity].color,
      blurb: it.blurb,
    };
  }

  // Einen Code einlösen. Ergebnis-Typen über `reason`:
  //   ok:true                      -> Item erhalten
  //   reason:'empty'               -> nichts eingegeben
  //   reason:'unknown'             -> Code existiert nicht
  //   reason:'used'                -> Code schon eingelöst
  redeem(raw) {
    const code = normalizeCode(raw);
    if (!code) return { ok: false, reason: 'empty' };

    const itemId = CODES[code];
    if (!itemId) return { ok: false, reason: 'unknown', code };

    if (this.used.has(code)) {
      return { ok: false, reason: 'used', code, itemId, item: this._entry(itemId) };
    }

    this.used.add(code);
    this.inventory.set(itemId, (this.inventory.get(itemId) || 0) + 1);
    this.lastItemId = itemId;
    return { ok: true, code, itemId, item: this._entry(itemId), count: this.inventory.get(itemId) };
  }

  // Item ohne Code gutschreiben (z. B. Belohnung fürs Meistern der Obby).
  grantItem(id) {
    this.inventory.set(id, (this.inventory.get(id) || 0) + 1);
    this.lastItemId = id;
    return this._entry(id);
  }

  has(id) {
    return this.inventory.has(id);
  }

  count(id) {
    return this.inventory.get(id) || 0;
  }

  totalItems() {
    let n = 0;
    for (const c of this.inventory.values()) n += c;
    return n;
  }

  distinctItems() {
    return this.inventory.size;
  }

  // Inventar als Liste, nach Seltenheit (selten zuerst), dann alphabetisch.
  list() {
    return [...this.inventory.entries()]
      .map(([id, count]) => ({ ...this._entry(id), count }))
      .sort(
        (a, b) =>
          RARITIES[b.rarity].order - RARITIES[a.rarity].order ||
          a.name.localeCompare(b.name, 'de')
      );
  }

  // Beispielcodes fürs Einlöse-Fenster (Code + zugehöriges Item).
  exampleCodes() {
    return EXAMPLE_CODES.map((code) => ({ code, item: this._entry(CODES[code]) }));
  }

  snapshot() {
    return {
      total: this.totalItems(),
      distinct: this.distinctItems(),
      items: this.list(),
      lastItemId: this.lastItemId,
    };
  }
}
