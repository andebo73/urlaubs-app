// GameState: Single Source of Truth. Aggregiert die gesamte Spiellogik.
// Kernidee (angelehnt an echte Live-Rollenspiel-Anlagen, aber eigenständig):
// Klasse wählen -> Rohstoffe im Labyrinth sammeln (auch aus Kämpfen) ->
// beim Händler 5 gildeneigene Rohstoffe abgeben -> Stufe aufsteigen ->
// bis zur Meister-Stufe. Reine Logik: kein DOM.

import { Rng } from './rng.js';
import { generateMaze } from './maze.js';
import { paintWalls, viertelAt, VIERTEL } from './viertel.js';
import { Player } from './player.js';
import { moveRelative, rotate } from './movement.js';
import { populate, resetEntityIds } from './entities.js';
import { Inventory } from './inventory.js';
import { playerAttack } from './combat.js';
import { RESOURCES, RESOURCES_PER_LEVEL, MAX_LEVEL, getClass } from './classes.js';

const DEFAULT_OPTS = {
  cols: 10,
  rows: 10,
  enemyCount: 9,
  resourceCount: 26,
  moveSpeed: 0.06,
  turnSpeed: 0.05,
  pickupRange: 0.6,
  attackRange: 1.1,
  talkRange: 1.0,
};

export class GameState {
  constructor(seed = 1, opts = {}) {
    this.opts = { ...DEFAULT_OPTS, ...opts };
    this.reset(seed);
  }

  // Baut die Welt neu auf. Startet im Modus 'classselect' (Klasse noch offen).
  reset(seed = this.seed ?? 1) {
    this.seed = seed >>> 0;
    this.rng = new Rng(this.seed);
    resetEntityIds();

    this.grid = generateMaze(this.rng, this.opts.cols, this.opts.rows);
    paintWalls(this.grid); // Wandtexturen nach Vierteln

    const start = this.grid.freeCells()[0] || { x: 1, y: 1 };
    this.startCell = start;
    const facing = [
      [1, 0, 0],
      [0, 1, Math.PI / 2],
      [-1, 0, Math.PI],
      [0, -1, -Math.PI / 2],
    ].find(([dx, dy]) => this.grid.get(start.x + dx, start.y + dy) === 0);
    this.startAngle = facing ? facing[2] : 0;

    // Vorläufige Klasse; die echte Wahl setzt chooseClass().
    this.player = new Player('kaempfer', start.x + 0.5, start.y + 0.5, this.startAngle);

    const { enemies, resources, haendler } = populate(this.rng, this.grid, start, {
      enemyCount: this.opts.enemyCount,
      resourceCount: this.opts.resourceCount,
    });
    this.enemies = enemies;
    this.resources = resources;
    this.haendler = haendler;
    this.inventory = new Inventory();

    this.mode = 'classselect'; // 'classselect' | 'explore' | 'combat' | 'gameover' | 'win'
    this.combatEnemy = null;
    this.messages = [];
  }

  // Klasse festlegen und Spiel starten (bzw. Klasse wechseln).
  chooseClass(classId) {
    const c = getClass(classId);
    this.player = new Player(c.id, this.startCell.x + 0.5, this.startCell.y + 0.5, this.startAngle);
    this.mode = 'explore';
    this.log(`${c.name} gewählt. Sammle ${RESOURCES[c.resource].name} und bring sie zum Händler!`);
    return c;
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
  rotateBy(rad) {
    rotate(this.player, rad);
  }

  // --- Nähe-Helfer --------------------------------------------------------
  livingEnemies() {
    return this.enemies.filter((e) => e.alive && e.hp > 0);
  }
  uncollectedResources() {
    return this.resources.filter((r) => !r.collected);
  }

  _nearest(list) {
    let best = null;
    let bestD = Infinity;
    for (const o of list) {
      const d = Math.hypot(o.x - this.player.x, o.y - this.player.y);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best ? { obj: best, dist: bestD } : null;
  }
  nearestEnemy() {
    const n = this._nearest(this.livingEnemies());
    return n ? { enemy: n.obj, dist: n.dist } : null;
  }
  nearestResource() {
    const n = this._nearest(this.uncollectedResources());
    return n ? { res: n.obj, dist: n.dist } : null;
  }
  distToHaendler() {
    return Math.hypot(this.haendler.x - this.player.x, this.haendler.y - this.player.y);
  }

  currentViertel() {
    return viertelAt(this.grid, Math.floor(this.player.x), Math.floor(this.player.y));
  }

  // --- Interaktion ("Nehmen") --------------------------------------------
  interact() {
    if (this.mode !== 'explore') return { type: 'none' };

    if (this.distToHaendler() <= this.opts.talkRange) {
      return this.tradeAndHandIn();
    }
    const r = this.nearestResource();
    if (r && r.dist <= this.opts.pickupRange) {
      return this.pickup(r.res);
    }
    const e = this.nearestEnemy();
    if (e && e.dist <= this.opts.attackRange) {
      return this.startCombat(e.enemy);
    }
    return { type: 'none' };
  }

  pickup(res) {
    res.collected = true;
    this.inventory.add(res.resId);
    this.log(`${RESOURCES[res.resId].name} gefunden!`);
    return { type: 'resource', resId: res.resId };
  }

  // --- Händler: umtauschen (2 fremde -> 1 eigener) und abgeben (5 -> Stufe) --
  tradeAndHandIn() {
    const p = this.player;
    const gid = p.resource;

    const convert = () => {
      while (this.inventory.count(gid) < RESOURCES_PER_LEVEL) {
        const other = this.inventory.mostAbundantOther(gid);
        if (!other || other.count < 2) break;
        this.inventory.remove(other.id, 2);
        this.inventory.add(gid, 1);
      }
    };

    convert();
    let levels = 0;
    while (this.inventory.count(gid) >= RESOURCES_PER_LEVEL && !p.isMaster()) {
      this.inventory.remove(gid, RESOURCES_PER_LEVEL);
      p.levelUp();
      levels += 1;
      convert();
    }

    if (levels > 0) {
      this.log(`Aufgestiegen! Du bist jetzt Stufe ${p.level}.`);
      if (p.isMaster()) {
        this.mode = 'win';
        this.log('Geschafft – du bist Meister der Tammo Stadt!');
      }
      return { type: 'levelup', levels, level: p.level, master: p.isMaster() };
    }

    const have = this.inventory.count(gid);
    this.log(`Bring mir ${RESOURCES_PER_LEVEL} ${RESOURCES[gid].name} (${have}/${RESOURCES_PER_LEVEL}).`);
    return { type: 'need', have, need: RESOURCES_PER_LEVEL };
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
    res.type = 'attack';

    if (res.enemyDefeated) {
      enemy.alive = false;
      this.inventory.add(enemy.drop);
      res.drop = enemy.drop;
      this.log(`${enemy.name} besiegt! Du erhältst 1 ${RESOURCES[enemy.drop].name}.`);
      // Heiler bekommt nach dem Kampf etwas Leben zurück.
      if (this.player.healBonus > 0) this.player.heal(this.player.healBonus);
      this.mode = 'explore';
      this.combatEnemy = null;
    } else if (res.playerDefeated) {
      this.mode = 'gameover';
      this.log('Du wurdest besiegt... Neustart mit R.');
    }
    return res;
  }

  flee() {
    if (this.mode !== 'combat') return false;
    moveRelative(this.grid, this.player, -this.opts.moveSpeed * 4, 0);
    this.mode = 'explore';
    this.combatEnemy = null;
    this.log('Du bist geflohen.');
    return true;
  }

  isOver() {
    return this.mode === 'gameover' || this.mode === 'win';
  }

  // --- Snapshot für HUD/Guide/Tests --------------------------------------
  snapshot() {
    const p = this.player;
    const gid = p.resource;
    const viertel = this.currentViertel();
    return {
      seed: this.seed,
      mode: this.mode,
      class: {
        id: p.classId,
        name: p.className,
        color: p.color,
        resource: gid,
        resourceName: RESOURCES[gid].name,
      },
      player: {
        x: p.x,
        y: p.y,
        angle: p.angle,
        hp: p.hp,
        maxHp: p.maxHp,
        level: p.level,
        strength: p.strength,
        isMaster: p.isMaster(),
      },
      guild: { have: this.inventory.count(gid), need: RESOURCES_PER_LEVEL, resource: gid },
      resources: this.inventory.list(),
      enemyCount: this.livingEnemies().length,
      resourceCount: this.uncollectedResources().length,
      viertel,
      viertelName: VIERTEL[viertel].name,
      maxLevel: MAX_LEVEL,
      message: this.lastMessage(),
    };
  }
}
