// Kartensammlung des Spielers. Reine Logik: kein DOM.
// Speichert, welche Karten-Typen (cardId) bereits gefunden wurden, inkl. Anzahl.

import { CARD_DEFS } from './entities.js';

export class Inventory {
  constructor() {
    // cardId -> Anzahl
    this.counts = new Map();
  }

  add(cardId) {
    this.counts.set(cardId, (this.counts.get(cardId) || 0) + 1);
  }

  has(cardId) {
    return (this.counts.get(cardId) || 0) > 0;
  }

  count(cardId) {
    return this.counts.get(cardId) || 0;
  }

  // Anzahl unterschiedlicher gesammelter Kartentypen.
  uniqueCount() {
    let n = 0;
    for (const v of this.counts.values()) if (v > 0) n++;
    return n;
  }

  // Gesamtzahl aller definierten Karten (für "x von y").
  static total() {
    return CARD_DEFS.length;
  }

  // Liste aller Kartentypen mit Sammelstatus (für HUD/Kartenübersicht).
  list() {
    return CARD_DEFS.map((d) => ({
      id: d.id,
      name: d.name,
      rarity: d.rarity,
      sprite: d.sprite,
      count: this.count(d.id),
      collected: this.has(d.id),
    }));
  }

  // Nur die IDs der gesammelten Karten (für Tests).
  collectedIds() {
    return CARD_DEFS.filter((d) => this.has(d.id)).map((d) => d.id);
  }
}
