// Spieler: Position/Blickrichtung, Werte, XP und Level-Aufstieg.
// Reine Logik: kein DOM.

// Erfahrung, die für die nächste Stufe nötig ist.
export function xpToNext(level) {
  return Math.round(10 * Math.pow(level, 1.5));
}

export class Player {
  constructor(x = 1.5, y = 1.5, angle = 0) {
    this.x = x;
    this.y = y;
    this.angle = angle; // Radiant

    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpToNext(1);

    this.strength = 3;
    this.maxHp = 20;
    this.hp = 20;
  }

  isAlive() {
    return this.hp > 0;
  }

  // Fügt Erfahrung hinzu und wickelt Stufenaufstiege ab.
  // Gibt ein Ergebnisobjekt zurück (nützlich für HUD/Tests).
  addXp(amount) {
    this.xp += amount;
    let leveledUp = false;
    let levelsGained = 0;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      levelsGained += 1;
      leveledUp = true;
      // Belohnungen pro Stufe
      this.maxHp += 5;
      this.strength += 1;
      this.hp = this.maxHp; // volle Heilung beim Aufstieg
      this.xpToNext = xpToNext(this.level);
    }
    return { leveledUp, levelsGained, level: this.level };
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    return this.hp;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp;
  }
}
