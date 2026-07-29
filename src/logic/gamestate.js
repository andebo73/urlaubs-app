// GameState: Single Source of Truth. Aggregiert die gesamte Spiellogik.
// Reine Logik: kein DOM, keine Canvas. Rendering liest nur aus diesem Objekt.

import { Rng } from './rng.js';
import { generateMaze } from './maze.js';
import { Player } from './player.js';
import { moveRelative, rotate } from './movement.js';
import { populate, resetEntityIds } from './entities.js';
import { Inventory } from './inventory.js';
import { playerAttack } from './combat.js';

const DEFAULT_OPTS = {
  cols: 10,
  rows: 10,
  enemyCount: 8,
  cardCount: 6,
  moveSpeed: 0.06, // Weltkoordinaten pro Bewegungsschritt
  turnSpeed: 0.05, // Radiant pro Drehschritt
  pickupRange: 0.6,
  attackRange: 1.1,
};

export class GameState {
  constructor(seed = 1, opts = {}) {
    this.opts = { ...DEFAULT_OPTS, ...opts };
    this.reset(seed);
  }

  reset(seed = this.seed ?? 1) {
    this.seed = seed >>> 0;
    this.rng = new Rng(this.seed);
    resetEntityIds();

    this.grid = generateMaze(this.rng, this.opts.cols, this.opts.rows);

    // Startposition: erste freie Zelle nahe oben links.
    const start = this.grid.freeCells()[0] || { x: 1, y: 1 };
    this.startCell = start;
    // Blickrichtung zu einer offenen Nachbarzelle (damit man sofort losgehen kann).
    const facing = [
      [1, 0, 0],
      [0, 1, Math.PI / 2],
      [-1, 0, Math.PI],
      [0, -1, -Math.PI / 2],
    ].find(([dx, dy]) => this.grid.get(start.x + dx, start.y + dy) === 0);
    const startAngle = facing ? facing[2] : 0;
    this.player = new Player(start.x + 0.5, start.y + 0.5, startAngle);

    const { enemies, cards } = populate(this.rng, this.grid, start, {
      enemyCount: this.opts.enemyCount,
      cardCount: this.opts.cardCount,
    });
    this.enemies = enemies;
    this.cards = cards;
    this.inventory = new Inventory();

    this.mode = 'explore'; // 'explore' | 'combat' | 'gameover' | 'win'
    this.combatEnemy = null;
    this.messages = []; // kurze Ereignistexte für das HUD
    this.log('Willkommen in Tammo Stadt! Finde alle Karten.');
  }

  log(text) {
    this.messages.push({ text, t: this.messages.length });
    if (this.messages.length > 20) this.messages.shift();
  }

  lastMessage() {
    return this.messages.length ? this.messages[this.messages.length - 1].text : '';
  }

  // --- Bewegung -----------------------------------------------------------
  moveForward(sign = 1) {
    if (this.mode !== 'explore') return false;
    return moveRelative(this.grid, this.player, this.opts.moveSpeed * sign, 0);
  }

  strafe(sign = 1) {
    if (this.mode !== 'explore') return false;
    return moveRelative(this.grid, this.player, 0, this.opts.moveSpeed * sign);
  }

  turn(sign = 1) {
    rotate(this.player, this.opts.turnSpeed * sign);
  }

  // Freie Rotation um beliebigen Winkel (für Touch-/Maus-Blick).
  rotateBy(rad) {
    rotate(this.player, rad);
  }

  // --- Gegner / Nähe ------------------------------------------------------
  livingEnemies() {
    return this.enemies.filter((e) => e.alive && e.hp > 0);
  }

  nearestEnemy() {
    let best = null;
    let bestD = Infinity;
    for (const e of this.livingEnemies()) {
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best ? { enemy: best, dist: bestD } : null;
  }

  uncollectedCards() {
    return this.cards.filter((c) => !c.collected);
  }

  nearestCard() {
    let best = null;
    let bestD = Infinity;
    for (const c of this.uncollectedCards()) {
      const d = Math.hypot(c.x - this.player.x, c.y - this.player.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best ? { card: best, dist: bestD } : null;
  }

  // --- Interaktion --------------------------------------------------------
  // "Nehmen": sammelt eine Karte in Reichweite oder startet einen Kampf,
  // wenn ein Gegner in Reichweite ist. Gibt eine Beschreibung des Ereignisses.
  interact() {
    if (this.mode !== 'explore') return { type: 'none' };

    const card = this.nearestCard();
    if (card && card.dist <= this.opts.pickupRange) {
      return this.pickup(card.card);
    }

    const enemy = this.nearestEnemy();
    if (enemy && enemy.dist <= this.opts.attackRange) {
      return this.startCombat(enemy.enemy);
    }

    return { type: 'none' };
  }

  pickup(card) {
    card.collected = true;
    this.inventory.add(card.cardId);
    this.log(`Neue Karte gefunden: ${card.name}!`);
    const result = { type: 'card', cardId: card.cardId, name: card.name };
    if (this.uncollectedCards().length === 0) {
      this.mode = 'win';
      this.log('Geschafft! Du hast alle Karten gesammelt!');
      result.win = true;
    }
    return result;
  }

  startCombat(enemy) {
    this.mode = 'combat';
    this.combatEnemy = enemy;
    this.log(`Ein ${enemy.name} greift an!`);
    return { type: 'combat', enemy };
  }

  // --- Kampf --------------------------------------------------------------
  attack() {
    if (this.mode !== 'combat' || !this.combatEnemy) return { type: 'none' };
    const enemy = this.combatEnemy;
    const res = playerAttack(this.rng, this.player, enemy);

    if (res.enemyDefeated) {
      enemy.alive = false;
      this.log(`${enemy.name} besiegt! +${res.xpGained} EP`);
      if (res.leveledUp) this.log(`Stufe ${this.player.level} erreicht!`);
      this.mode = 'explore';
      this.combatEnemy = null;
    } else if (res.playerDefeated) {
      this.mode = 'gameover';
      this.log('Du wurdest besiegt... Drücke Neustart.');
    }
    return { type: 'attack', ...res };
  }

  flee() {
    if (this.mode !== 'combat') return false;
    // Kleiner Rückstoß entgegen der Blickrichtung.
    moveRelative(this.grid, this.player, -this.opts.moveSpeed * 4, 0);
    this.mode = 'explore';
    this.combatEnemy = null;
    this.log('Du bist geflohen.');
    return true;
  }

  isOver() {
    return this.mode === 'gameover' || this.mode === 'win';
  }

  // --- Snapshot für HUD/Tests --------------------------------------------
  snapshot() {
    const p = this.player;
    return {
      seed: this.seed,
      mode: this.mode,
      player: {
        x: p.x,
        y: p.y,
        angle: p.angle,
        hp: p.hp,
        maxHp: p.maxHp,
        level: p.level,
        xp: p.xp,
        xpToNext: p.xpToNext,
        strength: p.strength,
      },
      enemyCount: this.livingEnemies().length,
      cardCount: this.uncollectedCards().length,
      collected: this.inventory.uniqueCount(),
      totalCards: Inventory.total(),
      inventory: this.inventory.collectedIds(),
      message: this.lastMessage(),
    };
  }
}
