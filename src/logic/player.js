// Spieler: Klasse, Position/Blick, Leben und Stufenaufstieg.
// Aufstieg passiert nicht mehr über XP, sondern über das Abgeben von Rohstoffen
// beim Händler (siehe gamestate.js). Reine Logik: kein DOM.

import { getClass, MAX_LEVEL } from './classes.js';

export class Player {
  constructor(classId = 'kaempfer', x = 1.5, y = 1.5, angle = 0) {
    const c = getClass(classId);
    this.classId = c.id;
    this.className = c.name;
    this.color = c.color;
    this.resource = c.resource; // Gilden-Rohstoff für den Aufstieg
    this.healBonus = c.healBonus;

    this.x = x;
    this.y = y;
    this.angle = angle;

    this.level = 1;
    this.strength = c.strength;
    this.maxHp = c.maxHp;
    this.hp = c.maxHp;
  }

  isAlive() {
    return this.hp > 0;
  }

  isMaster() {
    return this.level >= MAX_LEVEL;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    return this.hp;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp;
  }

  // Eine Stufe aufsteigen: mehr Leben und Stärke, volle Heilung.
  levelUp() {
    if (this.level >= MAX_LEVEL) return false;
    this.level += 1;
    this.maxHp += 5;
    this.strength += 1;
    this.hp = this.maxHp;
    return true;
  }
}
