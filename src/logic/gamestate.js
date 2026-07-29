// GameState: Single Source of Truth. Aggregiert die gesamte Spiellogik.
// Kernidee (angelehnt an echte Live-Rollenspiel-Anlagen, aber eigenständig):
// Klasse wählen -> Rohstoffe im Labyrinth sammeln (auch aus Kämpfen) ->
// beim Händler 5 gildeneigene Rohstoffe abgeben -> Stufe aufsteigen ->
// bis zur Meister-Stufe. Reine Logik: kein DOM.

import { Rng } from './rng.js';
import { generateMaze } from './maze.js';
import { paintWalls, viertelAt, VIERTEL, DOOR_WALL } from './viertel.js';
import { Player } from './player.js';
import { moveRelative, rotate } from './movement.js';
import { populate, resetEntityIds } from './entities.js';
import { Inventory } from './inventory.js';
import { playerAttack } from './combat.js';
import {
  RESOURCES,
  RESOURCE_IDS,
  RESOURCES_PER_LEVEL,
  MAX_LEVEL,
  MAX_TIER,
  WEAPON_COST,
  ARMOR_COST,
  WEAPONS,
  getClass,
  canPickLocks,
  hasMagicLight,
} from './classes.js';

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

    const { enemies, resources, haendler, bewohner, keys, chests, doors } = populate(
      this.rng,
      this.grid,
      start,
      { enemyCount: this.opts.enemyCount, resourceCount: this.opts.resourceCount }
    );
    this.enemies = enemies;
    this.resources = resources;
    this.haendler = haendler;
    this.bewohner = bewohner;
    this.keyItems = keys;
    this.chests = chests;

    // Türen als geschlossene Wandzellen (ID DOOR_WALL) in das Gitter eintragen.
    this.doors = new Map();
    for (const d of doors) {
      this.grid.set(d.x, d.y, DOOR_WALL);
      this.doors.set(`${d.x},${d.y}`, { x: d.x, y: d.y, open: false });
    }

    this.inventory = new Inventory();
    this.defeatedCount = 0; // für Aufträge
    this.pickupCount = 0;
    this.chestsOpenedCount = 0;
    this.visited = new Set();
    this.quest = null;

    this.mode = 'classselect'; // 'classselect' | 'explore' | 'combat' | 'gameover' | 'win'
    this.combatEnemy = null;
    this.messages = [];
  }

  // Klasse festlegen und Spiel starten (bzw. Klasse wechseln).
  chooseClass(classId) {
    const c = getClass(classId);
    this.player = new Player(c.id, this.startCell.x + 0.5, this.startCell.y + 0.5, this.startAngle);
    this.mode = 'explore';
    this.visited = new Set([this.currentViertel()]);
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
    const moved = moveRelative(this.grid, this.player, this.opts.moveSpeed * sign, 0);
    if (moved) this.markVisited();
    return moved;
  }
  strafe(sign = 1) {
    if (this.mode !== 'explore') return false;
    const moved = moveRelative(this.grid, this.player, 0, this.opts.moveSpeed * sign);
    if (moved) this.markVisited();
    return moved;
  }
  markVisited() {
    if (this.visited) this.visited.add(this.currentViertel());
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
  distToBewohner() {
    return Math.hypot(this.bewohner.x - this.player.x, this.bewohner.y - this.player.y);
  }
  nearestKey() {
    const n = this._nearest(this.keyItems.filter((k) => !k.collected));
    return n ? { key: n.obj, dist: n.dist } : null;
  }
  nearestChest() {
    const n = this._nearest(this.chests.filter((c) => !c.opened));
    return n ? { chest: n.obj, dist: n.dist } : null;
  }
  // Die Gitterzelle direkt vor dem Spieler (für Türen).
  frontCell() {
    const fx = Math.floor(this.player.x + Math.cos(this.player.angle) * 0.7);
    const fy = Math.floor(this.player.y + Math.sin(this.player.angle) * 0.7);
    return { x: fx, y: fy, door: this.doors.get(`${fx},${fy}`) };
  }

  currentViertel() {
    return viertelAt(this.grid, Math.floor(this.player.x), Math.floor(this.player.y));
  }

  // Helligkeit (0..1): Katakomben sind dunkel – außer der Magier (Zauberlicht).
  lightLevel() {
    if (this.currentViertel() === 'katakomben' && !hasMagicLight(this.player.classId)) {
      return 0.42;
    }
    return 1;
  }

  canOpenLocks() {
    return canPickLocks(this.player.classId) || this.inventory.keys > 0;
  }
  // Verbraucht bei Nicht-Schurken einen Schlüssel; Schurke öffnet gratis.
  _consumeLock() {
    if (canPickLocks(this.player.classId)) return true;
    return this.inventory.spendKey();
  }

  // --- Interaktion ("Nehmen") --------------------------------------------
  interact() {
    if (this.mode !== 'explore') return { type: 'none' };

    if (this.distToHaendler() <= this.opts.talkRange) return { type: 'shop' };
    if (this.distToBewohner() <= this.opts.talkRange) return this.talkBewohner();

    const chest = this.nearestChest();
    if (chest && chest.dist <= this.opts.pickupRange + 0.3) return this.openChest(chest.chest);

    const front = this.frontCell();
    if (front.door && !front.door.open) return this.openDoor(front.door);

    const k = this.nearestKey();
    if (k && k.dist <= this.opts.pickupRange) return this.pickupKey(k.key);

    const r = this.nearestResource();
    if (r && r.dist <= this.opts.pickupRange) return this.pickup(r.res);

    const e = this.nearestEnemy();
    if (e && e.dist <= this.opts.attackRange) return this.startCombat(e.enemy);

    return { type: 'none' };
  }

  pickup(res) {
    res.collected = true;
    this.inventory.add(res.resId);
    this.pickupCount += 1;
    this.log(`${RESOURCES[res.resId].name} gefunden!`);
    return { type: 'resource', resId: res.resId };
  }

  pickupKey(key) {
    key.collected = true;
    this.inventory.addKey();
    this.log('Schlüssel gefunden!');
    return { type: 'key', keys: this.inventory.keys };
  }

  openDoor(door) {
    if (!this.canOpenLocks()) {
      this.log('Verschlossene Tür – du brauchst einen Schlüssel (oder den Schurken).');
      return { type: 'door', opened: false };
    }
    this._consumeLock();
    door.open = true;
    this.grid.set(door.x, door.y, 0); // Tür öffnen = Zelle begehbar
    this.log(canPickLocks(this.player.classId) ? 'Der Schurke knackt die Tür!' : 'Tür mit Schlüssel geöffnet.');
    return { type: 'door', opened: true };
  }

  openChest(chest) {
    if (!this.canOpenLocks()) {
      this.log('Verschlossene Truhe – du brauchst einen Schlüssel (oder den Schurken).');
      return { type: 'chest', opened: false };
    }
    this._consumeLock();
    chest.opened = true;
    this.chestsOpenedCount += 1;
    this.inventory.add(chest.loot.resId, chest.loot.amount);
    this.log(`Truhe geöffnet: +${chest.loot.amount} ${RESOURCES[chest.loot.resId].name}!`);
    return { type: 'chest', opened: true, loot: chest.loot };
  }

  // --- Ausrüstung kaufen (Händler-Shop) ----------------------------------
  // Kosten werden aus dem Rohstoff-Vorrat bezahlt (Gilden-Rohstoff zuletzt,
  // damit das Aufsteigen nicht blockiert wird).
  _spendResources(n) {
    if (this.inventory.total() < n) return false;
    let left = n;
    const order = RESOURCE_IDS.slice().sort(
      (a, b) => (a === this.player.resource ? 1 : 0) - (b === this.player.resource ? 1 : 0)
    );
    for (const id of order) {
      while (left > 0 && this.inventory.count(id) > 0) {
        this.inventory.remove(id, 1);
        left -= 1;
      }
    }
    return left === 0;
  }

  weaponCost() {
    return this.player.weaponTier < MAX_TIER ? WEAPON_COST[this.player.weaponTier] : null;
  }
  armorCost() {
    return this.player.armorTier < MAX_TIER ? ARMOR_COST[this.player.armorTier] : null;
  }

  buyWeapon() {
    const cost = this.weaponCost();
    if (cost == null) return { type: 'weapon', ok: false, reason: 'max' };
    if (!this._spendResources(cost)) return { type: 'weapon', ok: false, reason: 'cost', cost };
    this.player.weaponTier += 1;
    this.log(`Waffe verbessert – Stufe ${this.player.weaponTier}!`);
    return { type: 'weapon', ok: true, tier: this.player.weaponTier };
  }
  buyArmor() {
    const cost = this.armorCost();
    if (cost == null) return { type: 'armor', ok: false, reason: 'max' };
    if (!this._spendResources(cost)) return { type: 'armor', ok: false, reason: 'cost', cost };
    this.player.armorTier += 1;
    this.log(`Rüstung verbessert – Stufe ${this.player.armorTier}!`);
    return { type: 'armor', ok: true, tier: this.player.armorTier };
  }

  // --- Aufträge (Bewohner) ------------------------------------------------
  talkBewohner() {
    if (!this.quest) {
      this.quest = this._makeQuest();
      this.log(`Auftrag: ${this._questText(this.quest)}`);
      return { type: 'quest', state: 'new', quest: this._questInfo() };
    }
    const info = this._questInfo();
    if (info.done) {
      this.inventory.addKey(this.quest.reward);
      this.log(`Auftrag erledigt! Belohnung: ${this.quest.reward} Schlüssel.`);
      this.quest = null;
      return { type: 'quest', state: 'done', rewardKeys: info.reward };
    }
    this.log(`Auftrag: ${this._questText(this.quest)} (${info.progress}/${info.target})`);
    return { type: 'quest', state: 'progress', quest: info };
  }

  _makeQuest() {
    const kinds = [
      { type: 'defeat', target: 2, base: this.defeatedCount, reward: 2 },
      { type: 'collect', target: 4, base: this.pickupCount, reward: 2 },
      { type: 'chests', target: 1, base: this.chestsOpenedCount, reward: 2 },
      { type: 'visit', target: 4, base: 0, reward: 3 }, // alle vier Viertel besuchen
    ];
    return kinds[this.rng.int(0, kinds.length - 1)];
  }
  _questProgress(q) {
    switch (q.type) {
      case 'defeat':
        return this.defeatedCount - q.base;
      case 'collect':
        return this.pickupCount - q.base;
      case 'chests':
        return this.chestsOpenedCount - q.base;
      case 'visit':
        return this.visited.size;
      default:
        return 0;
    }
  }
  _questText(q) {
    switch (q.type) {
      case 'defeat':
        return `Besiege ${q.target} Kobolde`;
      case 'collect':
        return `Sammle ${q.target} Rohstoffe`;
      case 'chests':
        return `Öffne ${q.target} Truhe`;
      case 'visit':
        return `Besuche alle ${q.target} Viertel`;
      default:
        return 'Auftrag';
    }
  }
  _questInfo() {
    if (!this.quest) return null;
    const progress = Math.min(this._questProgress(this.quest), this.quest.target);
    return {
      type: this.quest.type,
      text: this._questText(this.quest),
      progress,
      target: this.quest.target,
      reward: this.quest.reward,
      done: progress >= this.quest.target,
    };
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
      this.defeatedCount += 1;
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
      totalResources: this.inventory.total(),
      equip: {
        weaponTier: p.weaponTier,
        armorTier: p.armorTier,
        weapon: WEAPONS[p.classId],
        maxTier: MAX_TIER,
        weaponCost: this.weaponCost(),
        armorCost: this.armorCost(),
        attackPower: p.attackPower(),
      },
      keys: this.inventory.keys,
      quest: this._questInfo(),
      light: this.lightLevel(),
      enemyCount: this.livingEnemies().length,
      resourceCount: this.uncollectedResources().length,
      viertel,
      viertelName: VIERTEL[viertel].name,
      maxLevel: MAX_LEVEL,
      message: this.lastMessage(),
    };
  }
}
