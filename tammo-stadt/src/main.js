// Bootstrap: verbindet Logik, Rendering und Eingabe, betreibt die Render-Schleife
// und installiert die Test-API window.TammoTest.

import { GameState } from './logic/gamestate.js';
import { TextureStore } from './engine/textures.js';
import { castWalls } from './engine/raycaster.js';
import { drawSprites } from './engine/sprites.js';
import { drawMinimap } from './engine/minimap.js';
import { Hud } from './engine/hud.js';
import { Sfx } from './engine/audio.js';
import { buildGuideHtml } from './engine/guide.js';
import { InputState } from './input.js';
import { TouchControls } from './touchcontrols.js';
import { SVGS } from './assets/svg.js';
import { CLASSES, RESOURCES } from './logic/classes.js';

const DPR_CAP = 2;

class Game {
  constructor() {
    this.view = document.getElementById('view');
    this.displayCtx = this.view.getContext('2d');
    this.displayCtx.imageSmoothingEnabled = false;

    // Offscreen-Puffer für das 3D-Bild (niedrigere interne Auflösung).
    this.buffer = document.createElement('canvas');
    this.bufferCtx = this.buffer.getContext('2d');

    this.textures = new TextureStore();
    this.state = new GameState(this._randomSeed());
    this.input = new InputState();
    this.hud = new Hud(document);
    this.sfx = new Sfx();
    this.shopOpen = false;
    this._weaponSig = null;

    this.renderW = 1;
    this.renderH = 1;
    this.zBuffer = new Float32Array(1);
    this.imageData = null;
    this.lastFrame = null;
    this.ready = false;

    // Minikarte: Zoom-Zustand und aktuelles Rechteck (in CSS-Pixeln, für Klick-Test).
    this.minimapZoom = false;
    this.minimapRect = null;
  }

  _randomSeed() {
    // Nur beim echten Laden zufällig; Tests setzen einen festen Seed via reset().
    return (Date.now() ^ (Math.floor(Math.random() * 0xffffffff))) >>> 0;
  }

  async init() {
    // HUD-Icons einsetzen (Klassen-/Gilden-Icons setzt das HUD selbst).
    this._setSvg('icon-heart', SVGS.icon_heart);
    this._setSvg('icon-shield', SVGS.icon_shield);

    await this.textures.load();

    this.input.attach(window);

    // Klick auf die Minikarte schaltet den Zoom um. Vor TouchControls
    // registriert, damit ein Karten-Klick nicht zugleich die Kamera dreht.
    this.view.addEventListener('pointerdown', (e) => {
      if (this.hitMinimap(e.clientX, e.clientY)) {
        this.toggleMinimapZoom();
        this.render();
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    });

    this.touch = new TouchControls(
      document.getElementById('touch-controls'),
      this.input,
      this.view,
      this.state
    );

    this._wireButtons();
    this._wireGuide();
    this._wireClassSelect();
    this._wireShop();
    this._wireMute();
    // AudioContext bei der ersten Nutzergeste aktivieren (Autoplay-Regeln).
    const resumeAudio = () => this.sfx.ensure();
    window.addEventListener('pointerdown', resumeAudio, { once: true });
    window.addEventListener('keydown', resumeAudio, { once: true });
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());
    this.resize();

    // Zoom per Doppeltipp / Kontextmenü unterbinden.
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());

    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');

    // Klassenwahl zeigen (Spiel startet erst nach der Wahl).
    this.showClassSelect();

    this.ready = true;
    this.loop();
  }

  // Baut die Klassen-Buttons und verdrahtet die Auswahl.
  _wireClassSelect() {
    const list = document.getElementById('class-list');
    this.classOverlay = document.getElementById('class-overlay');
    if (!list) return;
    list.innerHTML = CLASSES.map(
      (c) => `
      <button class="class-card" type="button" data-class="${c.id}">
        <span class="cc-head"><span class="cc-icon">${SVGS[c.icon] || ''}</span>${c.name}</span>
        <span class="cc-ability">${c.ability}</span>
        <span class="cc-res"><span class="res-dot" style="background:${RESOURCES[c.resource].color}"></span>sammelt ${RESOURCES[c.resource].name}</span>
      </button>`
    ).join('');
    list.querySelectorAll('.class-card').forEach((btn) => {
      btn.addEventListener('click', () => this.chooseClass(btn.dataset.class));
    });
  }

  showClassSelect() {
    if (this.classOverlay) this.classOverlay.classList.add('show');
  }

  chooseClass(classId) {
    this.state.chooseClass(classId);
    if (this.classOverlay) this.classOverlay.classList.remove('show');
    this.sfx.play('shop');
  }

  // --- Händler-Shop -------------------------------------------------------
  _wireShop() {
    this.shopOverlay = document.getElementById('shop-overlay');
    const level = document.getElementById('shop-level');
    const weapon = document.getElementById('shop-weapon');
    const armor = document.getElementById('shop-armor');
    const close = document.getElementById('shop-close');
    if (level)
      level.addEventListener('click', () => {
        const r = this.state.tradeAndHandIn();
        this.sfx.play(r.type === 'levelup' ? 'level' : 'error');
        if (this.state.mode === 'win') this.closeShop();
        this.refreshShop();
      });
    if (weapon)
      weapon.addEventListener('click', () => {
        const r = this.state.buyWeapon();
        this.sfx.play(r.ok ? 'buy' : 'error');
        this.refreshShop();
      });
    if (armor)
      armor.addEventListener('click', () => {
        const r = this.state.buyArmor();
        this.sfx.play(r.ok ? 'buy' : 'error');
        this.refreshShop();
      });
    if (close) close.addEventListener('click', () => this.closeShop());
    if (this.shopOverlay)
      this.shopOverlay.addEventListener('click', (e) => {
        if (e.target === this.shopOverlay) this.closeShop();
      });
  }

  openShop() {
    this.shopOpen = true;
    this.refreshShop();
    if (this.shopOverlay) this.shopOverlay.classList.add('show');
  }
  closeShop() {
    this.shopOpen = false;
    if (this.shopOverlay) this.shopOverlay.classList.remove('show');
  }
  refreshShop() {
    const info = document.getElementById('shop-info');
    const s = this.state.snapshot();
    if (info) {
      const wc = s.equip.weaponCost;
      const ac = s.equip.armorCost;
      info.innerHTML = `
        <div class="row"><span>Stufenkarte</span><b>${s.guild.have}/${s.guild.need} ${s.class.resourceName}</b></div>
        <div class="row"><span>Rohstoffe gesamt</span><b>${s.totalResources}</b></div>
        <div class="row"><span>Waffe</span><b>Stufe ${s.equip.weaponTier}/${s.equip.maxTier} · Angriff ${s.equip.attackPower}</b></div>
        <div class="row"><span>Rüstung</span><b>Stufe ${s.equip.armorTier}/${s.equip.maxTier}</b></div>`;
      const lvlBtn = document.getElementById('shop-level');
      const wBtn = document.getElementById('shop-weapon');
      const aBtn = document.getElementById('shop-armor');
      if (lvlBtn) {
        lvlBtn.textContent = s.player.isMaster ? 'Meister erreicht' : `Aufsteigen (5 ${s.class.resourceName})`;
        lvlBtn.disabled = s.player.isMaster;
      }
      if (wBtn) {
        wBtn.textContent = wc == null ? 'Waffe max.' : `Waffe verbessern (${wc} Rohstoffe)`;
        wBtn.disabled = wc == null || s.totalResources < wc;
      }
      if (aBtn) {
        aBtn.textContent = ac == null ? 'Rüstung max.' : `Rüstung verbessern (${ac} Rohstoffe)`;
        aBtn.disabled = ac == null || s.totalResources < ac;
      }
    }
  }

  _wireMute() {
    const btn = document.getElementById('btn-mute');
    if (!btn) return;
    this.muteBtn = btn;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const muted = this.sfx.toggleMute();
      btn.textContent = muted ? '🔇' : '🔊';
      if (!muted) this.sfx.play('pickup');
    });
  }

  // Sichtbare Waffe unten aktualisieren (nur bei Klassen-/Stufenwechsel).
  updateWeapon() {
    const el = document.getElementById('weapon');
    if (!el) return;
    if (this.state.mode === 'classselect') {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    const p = this.state.player;
    const sig = `${p.classId}:${p.weaponTier}`;
    if (sig === this._weaponSig) return;
    this._weaponSig = sig;
    const svg = SVGS['weapon_' + p.classId] || '';
    let pips = '';
    for (let i = 0; i < p.weaponTier; i++) pips += '<i></i>';
    el.innerHTML = svg + `<span class="weapon-tier">${pips}</span>`;
  }

  _setSvg(id, svg) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = svg;
  }

  _wireButtons() {
    const attack = document.getElementById('btn-attack');
    const flee = document.getElementById('btn-flee');
    const restart = document.getElementById('btn-restart');
    if (attack) attack.addEventListener('click', () => (this.input.pendingAttack = true));
    if (flee) flee.addEventListener('click', () => (this.input.pendingFlee = true));
    if (restart) restart.addEventListener('click', () => this.restart());
  }

  restart() {
    this.state.reset(this._randomSeed());
    if (this.touch) this.touch.game = this.state;
    this.closeShop();
    this._weaponSig = null;
    this.showClassSelect();
  }

  // Klick auf den Header öffnet die Spielanleitung. Der Inhalt wird bei jedem
  // Öffnen frisch aus den aktuellen Spiel-Daten erzeugt -> immer aktuell.
  _wireGuide() {
    const hud = document.getElementById('hud');
    const overlay = document.getElementById('guide-overlay');
    const content = document.getElementById('guide-content');
    const closeBtn = document.getElementById('guide-close');
    if (!hud || !overlay || !content) return;

    this.openGuide = () => {
      content.innerHTML = buildGuideHtml(this.state);
      overlay.classList.add('show');
    };
    this.closeGuide = () => overlay.classList.remove('show');

    hud.addEventListener('click', () => this.openGuide());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeGuide());
    // Klick auf den abgedunkelten Hintergrund schließt.
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeGuide();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeGuide();
    });
  }

  resize() {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);

    // Display-Canvas in Geräte-Pixeln.
    this.view.width = Math.max(1, Math.round(cssW * dpr));
    this.view.height = Math.max(1, Math.round(cssH * dpr));
    this.displayCtx.imageSmoothingEnabled = false;

    // Interne Render-Auflösung (Performance auf Handys begrenzen).
    const targetW = Math.min(640, Math.max(200, Math.round(cssW * 0.55)));
    this.renderW = targetW;
    this.renderH = Math.max(120, Math.round(targetW * (cssH / cssW)));

    this.buffer.width = this.renderW;
    this.buffer.height = this.renderH;
    this.zBuffer = new Float32Array(this.renderW);
    this.imageData = this.bufferCtx.createImageData(this.renderW, this.renderH);

    // Unterkante des (klickbaren) Headers merken, damit die Minikarte darunter
    // sitzt und Klicks sich nicht überschneiden.
    const hud = document.getElementById('hud');
    this.headerBottomCss = hud ? hud.getBoundingClientRect().bottom : 64;
  }

  // Ein Simulationsschritt aus der aktuellen Eingabe (ein Frame).
  step() {
    const actions = this.input.consume();

    if (actions.restart && this.state.isOver()) {
      this.restart();
      return;
    }
    if (this.shopOpen) return; // Shop offen -> Spiel pausiert

    if (this.state.mode === 'explore') {
      const a = this.input.axes();
      if (a.forward) this.state.moveForward(a.forward);
      if (a.strafe) this.state.strafe(a.strafe);
      if (a.turn) this.state.turn(a.turn);
      if (actions.interact || actions.attack) this._handleInteract(this.state.interact());
    } else if (this.state.mode === 'combat') {
      if (actions.attack || actions.interact) this._handleAttack(this.state.attack());
      if (actions.flee) {
        this.state.flee();
        this.sfx.play('door');
      }
    }
  }

  _handleInteract(res) {
    switch (res && res.type) {
      case 'shop':
        this.openShop();
        this.sfx.play('shop');
        break;
      case 'resource':
        this.sfx.play('pickup');
        break;
      case 'key':
        this.sfx.play('key');
        break;
      case 'chest':
        this.sfx.play(res.opened ? 'chest' : 'error');
        break;
      case 'door':
        this.sfx.play(res.opened ? 'door' : 'error');
        break;
      case 'combat':
        this.sfx.play('hit');
        break;
      case 'quest':
        this.sfx.play('quest');
        break;
      default:
        break;
    }
  }

  _handleAttack(res) {
    if (!res || res.type !== 'attack') return;
    if (res.enemyDefeated) this.sfx.play('defeat');
    else if (res.playerDefeated) this.sfx.play('lose');
    else this.sfx.play('hit');
  }

  render() {
    if (!this.imageData) return;
    // 3D-Bild in den Puffer rendern (mit Lichtfaktor, z. B. dunkle Katakomben).
    const light = this.state.lightLevel ? this.state.lightLevel() : 1;
    castWalls(this.imageData, this.renderW, this.renderH, this.state, this.textures, this.zBuffer, light);
    drawSprites(this.imageData, this.renderW, this.renderH, this.state, this.textures, this.zBuffer, light);
    this.bufferCtx.putImageData(this.imageData, 0, 0);
    this.lastFrame = this.imageData;

    // Auf das Display-Canvas skalieren.
    const dctx = this.displayCtx;
    dctx.imageSmoothingEnabled = false;
    dctx.drawImage(
      this.buffer,
      0, 0, this.renderW, this.renderH,
      0, 0, this.view.width, this.view.height
    );

    // Minikarte – klickbar: normal (oben rechts) oder vergrößert (zentriert).
    const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    const cssW = this.view.width / dpr;
    const cssH = this.view.height / dpr;
    let size, x, y;
    if (this.minimapZoom) {
      size = Math.min(cssW, cssH) * 0.82;
      x = (cssW - size) / 2;
      y = (cssH - size) / 2;
    } else {
      size = Math.min(150, cssW * 0.34);
      x = cssW - size - 10;
      y = (this.headerBottomCss || 64) + 8;
    }
    this.minimapRect = { x, y, size };
    drawMinimap(dctx, this.state, x * dpr, y * dpr, size * dpr);

    // Kampf-Gegnerbild aktualisieren.
    const art = document.getElementById('combat-enemy-art');
    if (art && this.state.mode === 'combat' && this.state.combatEnemy) {
      const key = this.state.combatEnemy.sprite;
      if (art.dataset.key !== key) {
        art.innerHTML = SVGS[key] || SVGS.goblin;
        art.dataset.key = key;
      }
    }

    this.updateWeapon();
    this.hud.update(this.state);
  }

  loop() {
    this.step();
    this.render();
    requestAnimationFrame(() => this.loop());
  }

  // Liegt der (CSS-)Punkt innerhalb der aktuellen Minikarte?
  hitMinimap(clientX, clientY) {
    const r = this.minimapRect;
    if (!r) return false;
    return (
      clientX >= r.x &&
      clientX <= r.x + r.size &&
      clientY >= r.y &&
      clientY <= r.y + r.size
    );
  }

  toggleMinimapZoom() {
    this.minimapZoom = !this.minimapZoom;
  }

  // Prüft, ob der letzte Frame quasi einfarbig (leer) ist.
  frameIsBlank() {
    const d = this.lastFrame && this.lastFrame.data;
    if (!d) return true;
    const r0 = d[0], g0 = d[1], b0 = d[2];
    for (let i = 0; i < d.length; i += 4 * 97) {
      if (Math.abs(d[i] - r0) > 8 || Math.abs(d[i + 1] - g0) > 8 || Math.abs(d[i + 2] - b0) > 8) {
        return false;
      }
    }
    return true;
  }
}

// --- Start ---
const game = new Game();

// Test-/Debug-API. Treibt ausschließlich den GameState (synchron) und rendert
// bei Bedarf einen Frame. Ermöglicht deterministische Playwright-Tests.
window.TammoTest = {
  get ready() {
    return game.ready;
  },
  game,
  // Deterministischer Neustart mit fester Klasse (Standard: Kämpfer).
  reset(seed = 1, classId = 'kaempfer') {
    game.state.reset(seed >>> 0);
    game.state.chooseClass(classId);
    if (game.touch) game.touch.game = game.state;
    if (game.classOverlay) game.classOverlay.classList.remove('show');
    game.render();
    return game.state.snapshot();
  },
  chooseClass(classId) {
    game.chooseClass(classId);
    return game.state.snapshot();
  },
  getState() {
    return game.state.snapshot();
  },
  getPlayer() {
    const p = game.state.player;
    return { x: p.x, y: p.y, angle: p.angle, hp: p.hp, maxHp: p.maxHp, level: p.level, strength: p.strength, classId: p.classId };
  },
  getClass() {
    return game.state.snapshot().class;
  },
  getEnemies() {
    return game.state.enemies.map((e) => ({ id: e.id, x: e.x, y: e.y, hp: e.hp, alive: e.alive && e.hp > 0, name: e.name }));
  },
  getResources() {
    return game.state.inventory.list();
  },
  guildProgress() {
    return game.state.snapshot().guild;
  },
  isWallAtPlayer() {
    const p = game.state.player;
    return game.state.grid.isWallAt(p.x, p.y);
  },
  move(steps = 1) {
    for (let i = 0; i < steps; i++) game.state.moveForward(1);
    return this.getPlayer();
  },
  strafe(steps = 1) {
    for (let i = 0; i < steps; i++) game.state.strafe(1);
    return this.getPlayer();
  },
  rotate(rad = 0) {
    game.state.rotateBy(rad);
    return this.getPlayer();
  },
  teleport(x, y) {
    game.state.player.x = x;
    game.state.player.y = y;
    return this.getPlayer();
  },
  forceEncounterNearest() {
    const near = game.state.nearestEnemy();
    if (!near) return null;
    const e = near.enemy;
    game.state.player.x = e.x - 0.6;
    game.state.player.y = e.y;
    game.state.startCombat(e);
    return { enemyId: e.id, mode: game.state.mode };
  },
  attack() {
    const r = game.state.attack();
    return {
      damageDealt: r.damageDealt || 0,
      enemyDefeated: !!r.enemyDefeated,
      drop: r.drop || null,
      playerDefeated: !!r.playerDefeated,
      mode: game.state.mode,
    };
  },
  pickupNearest() {
    const near = game.state.nearestResource();
    if (!near) return null;
    const res = game.state.pickup(near.res);
    return res.resId;
  },
  // --- Stufe 2: Schlüssel, Türen, Truhen, Aufträge, Licht ---
  getKeys() {
    return game.state.inventory.keys;
  },
  getQuest() {
    return game.state.snapshot().quest;
  },
  lightLevel() {
    return game.state.lightLevel();
  },
  pickupNearestKey() {
    const near = game.state.nearestKey();
    if (!near) return null;
    game.state.pickupKey(near.key);
    return game.state.inventory.keys;
  },
  openNearestChest() {
    const near = game.state.nearestChest();
    if (!near) return null;
    game.state.player.x = near.chest.x - 0.3;
    game.state.player.y = near.chest.y;
    return game.state.openChest(near.chest);
  },
  openFacingDoor() {
    // Vor die erste geschlossene Tür stellen und öffnen.
    for (const d of game.state.doors.values()) {
      if (d.open) continue;
      game.state.player.x = d.x + 0.5 - 0.7;
      game.state.player.y = d.y + 0.5;
      game.state.player.angle = 0;
      return game.state.openDoor(d);
    }
    return null;
  },
  talkBewohner() {
    game.state.player.x = game.state.bewohner.x - 0.4;
    game.state.player.y = game.state.bewohner.y;
    return game.state.talkBewohner();
  },
  teleportToViertel(name) {
    // Grobe Teleportation in ein Viertel (für Licht-Tests): unten-links = Katakomben.
    const g = game.state.grid;
    const targets = {
      handel: { x: 1.5, y: 1.5 },
      pilz: { x: g.width - 1.5, y: 1.5 },
      katakomben: { x: 1.5, y: g.height - 1.5 },
      mechanik: { x: g.width - 1.5, y: g.height - 1.5 },
    };
    const t = targets[name] || targets.handel;
    game.state.player.x = t.x;
    game.state.player.y = t.y;
    return { viertel: game.state.currentViertel(), light: game.state.lightLevel() };
  },
  // Zum Händler teleportieren und abgeben/umtauschen (Aufstieg).
  handInAtHaendler() {
    game.state.player.x = game.state.haendler.x - 0.4;
    game.state.player.y = game.state.haendler.y;
    return game.state.tradeAndHandIn();
  },
  // Bequemlichkeit für Tests: Gilden-Rohstoffe direkt gutschreiben.
  grantGuildResources(n = 5) {
    game.state.inventory.add(game.state.player.resource, n);
    return this.guildProgress();
  },
  // --- Stufe 3: Ausrüstung, Shop, Ton ---
  getEquipment() {
    return game.state.snapshot().equip;
  },
  grantResources(id, n = 10) {
    game.state.inventory.add(id, n);
    return game.state.inventory.total();
  },
  buyWeapon() {
    return game.state.buyWeapon();
  },
  buyArmor() {
    return game.state.buyArmor();
  },
  openShopAtHaendler() {
    game.state.player.x = game.state.haendler.x - 0.4;
    game.state.player.y = game.state.haendler.y;
    const r = game.state.interact();
    if (r && r.type === 'shop') game.openShop();
    return { type: r && r.type, shopOpen: game.shopOpen };
  },
  closeShop() {
    game.closeShop();
    return game.shopOpen;
  },
  toggleMute() {
    return game.sfx.toggleMute();
  },
  frame() {
    game.render();
    return true;
  },
  canvasIsBlank() {
    return game.frameIsBlank();
  },
};

game.init().catch((err) => {
  console.error('Init-Fehler:', err);
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = 'Fehler beim Laden: ' + err;
});
