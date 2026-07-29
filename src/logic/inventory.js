// Rohstoff-Inventar des Spielers (nach Farbe/Typ gezählt). Reine Logik: kein DOM.

import { RESOURCE_IDS, RESOURCES } from './classes.js';

export class Inventory {
  constructor() {
    this.counts = new Map();
    for (const id of RESOURCE_IDS) this.counts.set(id, 0);
  }

  add(id, n = 1) {
    this.counts.set(id, (this.counts.get(id) || 0) + n);
  }

  remove(id, n = 1) {
    this.counts.set(id, Math.max(0, (this.counts.get(id) || 0) - n));
  }

  count(id) {
    return this.counts.get(id) || 0;
  }

  total() {
    let s = 0;
    for (const v of this.counts.values()) s += v;
    return s;
  }

  // Rohstoff (außer exceptId) mit der größten Menge – für den Umtausch.
  mostAbundantOther(exceptId) {
    let best = null;
    let bestN = 0;
    for (const id of RESOURCE_IDS) {
      if (id === exceptId) continue;
      const n = this.count(id);
      if (n > bestN) {
        bestN = n;
        best = id;
      }
    }
    return best ? { id: best, count: bestN } : null;
  }

  // Liste für HUD/Guide: [{id, name, color, count}]
  list() {
    return RESOURCE_IDS.map((id) => ({
      id,
      name: RESOURCES[id].name,
      color: RESOURCES[id].color,
      count: this.count(id),
    }));
  }
}
