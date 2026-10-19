// Bootstrap für Code-Garten: verbindet den Spielzustand (Inventar/Codes) und die
// begehbare Welt mit dem 3D-Rendering und der Steuerung (Joystick, Tastatur,
// Ziehen zum Umsehen). Installiert die Test-API window.CodeGartenTest.

import { GameState } from './logic/gamestate.js';
import { World } from './logic/world.js';
import { drawWorld } from './engine/renderer.js';

const DPR_CAP = 2;
const LOOK_SENS = 0.005;

class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.state = new GameState();
    this.world = new World();
    this.ready = false;
    this.dpr = 1;
    this.cssW = 1;
    this.cssH = 1;
    this._last = 0;
    this._toastTimer = null;

    // Steuerungs-Zustand.
    this.keys = new Set();
    this.joy = { active: false, x: 0, y: 0, id: null };
    this.look = { id: null, lastX: 0, lastY: 0 };
    this._jump = false;        // Sprung angefordert (wird pro Frame verbraucht)
    this._lastRespawn = 0;     // zuletzt gesehener Respawn-Zähler
    this._rewardCode = null;   // zuletzt in der Obby freigeschalteter Code
  }

  init() {
    this._wireCodePanel();
    this._wireInfo();
    this._wireInventory();
    this._wireObby();
    this._wireControls();
    this.renderInventory();
    this.updateStats();

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    this.resize();

    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');
    this._hintTimer = setTimeout(() => {
      const h = document.getElementById('hint');
      if (h) h.classList.add('fade');
    }, 6000);

    this.ready = true;
    this._last = performance.now();
    this.loop(this._last);
  }

  // --- Steuerung -----------------------------------------------------------
  _wireControls() {
    window.addEventListener('keydown', (e) => {
      if (this._typing()) return;
      this.keys.add(e.code);
      if (e.code === 'Space') this._jump = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    // Sprung-Knopf.
    const jumpBtn = document.getElementById('jump-btn');
    if (jumpBtn) {
      jumpBtn.addEventListener('pointerdown', (e) => {
        this._jump = true;
        this._hideHint();
        e.stopPropagation();
      });
    }

    // Umsehen: über das Canvas ziehen (Maus oder Finger).
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.look.id !== null) return;
      this.look.id = e.pointerId;
      this.look.lastX = e.clientX;
      this.look.lastY = e.clientY;
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.look.id) return;
      const dx = e.clientX - this.look.lastX;
      const dy = e.clientY - this.look.lastY;
      this.look.lastX = e.clientX;
      this.look.lastY = e.clientY;
      this.world.applyTurn(dx * LOOK_SENS);
      this.world.applyPitch(dy * LOOK_SENS); // hoch/runter schauen (Turm)
      this._hideHint();
    });
    const endLook = (e) => {
      if (e.pointerId === this.look.id) this.look.id = null;
    };
    this.canvas.addEventListener('pointerup', endLook);
    this.canvas.addEventListener('pointercancel', endLook);

    // Joystick (bewegen).
    const stick = document.getElementById('joystick');
    const knob = document.getElementById('joystick-knob');
    if (stick && knob) {
      const radius = 46;
      const setKnob = (nx, ny) => {
        knob.style.transform = `translate(${nx * radius}px, ${ny * radius}px)`;
      };
      stick.addEventListener('pointerdown', (e) => {
        this.joy.active = true;
        this.joy.id = e.pointerId;
        stick.setPointerCapture(e.pointerId);
        this._rect = stick.getBoundingClientRect();
        this._updateJoy(e, setKnob, radius);
        this._hideHint();
        e.stopPropagation();
      });
      stick.addEventListener('pointermove', (e) => {
        if (e.pointerId !== this.joy.id) return;
        this._updateJoy(e, setKnob, radius);
        e.stopPropagation();
      });
      const endJoy = (e) => {
        if (e.pointerId !== this.joy.id) return;
        this.joy.active = false;
        this.joy.id = null;
        this.joy.x = 0;
        this.joy.y = 0;
        setKnob(0, 0);
      };
      stick.addEventListener('pointerup', endJoy);
      stick.addEventListener('pointercancel', endJoy);
    }
  }

  _updateJoy(e, setKnob, radius) {
    const r = this._rect;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let nx = (e.clientX - cx) / radius;
    let ny = (e.clientY - cy) / radius;
    const len = Math.hypot(nx, ny);
    if (len > 1) {
      nx /= len;
      ny /= len;
    }
    this.joy.x = nx;
    this.joy.y = ny;
    setKnob(nx, ny);
  }

  _typing() {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  }

  _hideHint() {
    const h = document.getElementById('hint');
    if (h) h.classList.add('fade');
  }

  // Aktuelle Steuer-Eingaben als { move, strafe, turn }.
  readControls() {
    let move = 0, strafe = 0, turn = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) move += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) move -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) turn -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) turn += 1;
    if (k.has('KeyQ')) strafe -= 1;
    if (k.has('KeyE')) strafe += 1;
    if (this.joy.active) {
      move += -this.joy.y;
      strafe += this.joy.x;
    }
    const jump = this._jump;
    this._jump = false;
    return {
      move: Math.max(-1, Math.min(1, move)),
      strafe: Math.max(-1, Math.min(1, strafe)),
      turn: Math.max(-1, Math.min(1, turn)),
      jump,
    };
  }

  // --- Einlöse-Fenster -----------------------------------------------------
  _wireCodePanel() {
    this.codeOverlay = document.getElementById('code-overlay');
    this.input = document.getElementById('code-input');
    const openBtn = document.getElementById('code-open');
    const closeBtn = document.getElementById('code-close');
    const form = document.getElementById('code-form');

    if (openBtn) openBtn.addEventListener('click', () => this.openCode());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeCode());
    if (this.codeOverlay)
      this.codeOverlay.addEventListener('click', (e) => {
        if (e.target === this.codeOverlay) this.closeCode();
      });
    if (form)
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.onRedeem(this.input ? this.input.value : '');
      });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeCode();
        this.closeInfo();
        this.closeInventory();
        this.closeObby();
      }
    });
  }

  openCode() {
    if (this.codeOverlay) this.codeOverlay.classList.add('show');
    if (this.input) {
      this.input.focus();
      this.input.select();
    }
  }
  closeCode() {
    if (this.codeOverlay) this.codeOverlay.classList.remove('show');
  }

  // --- Obby geschafft ------------------------------------------------------
  _wireObby() {
    this.obbyOverlay = document.getElementById('obby-overlay');
    const close = document.getElementById('obby-close');
    const redeem = document.getElementById('obby-redeem');
    if (close) close.addEventListener('click', () => this.closeObby());
    if (redeem)
      redeem.addEventListener('click', () => {
        this.closeObby();
        if (this.input && this._rewardCode) this.input.value = this._rewardCode;
        this.openCode();
      });
    if (this.obbyOverlay)
      this.obbyOverlay.addEventListener('click', (e) => {
        if (e.target === this.obbyOverlay) this.closeObby();
      });
  }

  // Wird aufgerufen, wenn das Obby-Ziel erreicht wurde.
  onObbyComplete() {
    this.world.returnToStart();
    const code = this.state.randomCodeReward();
    this._rewardCode = code;
    const item = this.state.itemForCode(code);
    const codeEl = document.getElementById('obby-code');
    const hintEl = document.getElementById('obby-hint');
    if (codeEl) codeEl.textContent = code;
    if (hintEl) hintEl.innerHTML = item ? `Schaltet frei: <b>${item.emoji} ${item.name}</b>` : '';
    if (this.obbyOverlay) this.obbyOverlay.classList.add('show');
    this.toast('🏆 Obby geschafft!', '#f6b400');
    return code;
  }
  closeObby() {
    if (this.obbyOverlay) this.obbyOverlay.classList.remove('show');
  }

  onRedeem(raw) {
    const r = this.state.redeem(raw);
    this.showResult(r);
    if (r.ok) {
      if (this.input) this.input.value = '';
      this.toast(`${r.item.emoji} ${r.item.name} erhalten!`, r.item.color);
      this.renderInventory();
      this.updateStats();
    }
    return r;
  }

  showResult(r) {
    const el = document.getElementById('code-result');
    if (!el) return;
    el.hidden = false;
    el.classList.remove('ok', 'err');
    if (r.ok) {
      el.classList.add('ok');
      el.innerHTML = `<b>Glückwunsch!</b> Du hast <b>${r.item.emoji} ${r.item.name}</b> <span class="tag" style="--chip:${r.item.color}">${r.item.rarity}</span> erhalten.`;
    } else if (r.reason === 'used') {
      el.classList.add('err');
      el.innerHTML = `Den Code <b>${r.code}</b> hast du schon eingelöst.`;
    } else if (r.reason === 'unknown') {
      el.classList.add('err');
      el.innerHTML = `Diesen Code kennen wir nicht. Probier einen der Beispielcodes unten.`;
    } else {
      el.classList.add('err');
      el.innerHTML = `Bitte gib zuerst einen Code ein.`;
    }
  }

  // --- Rucksack ------------------------------------------------------------
  _wireInventory() {
    this.invOverlay = document.getElementById('inv-overlay');
    const openBtn = document.getElementById('pack-btn');
    const closeBtn = document.getElementById('inv-close');
    if (openBtn) openBtn.addEventListener('click', () => this.openInventory());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeInventory());
    if (this.invOverlay)
      this.invOverlay.addEventListener('click', (e) => {
        if (e.target === this.invOverlay) this.closeInventory();
      });
  }
  openInventory() {
    this.renderInventory();
    if (this.invOverlay) this.invOverlay.classList.add('show');
  }
  closeInventory() {
    if (this.invOverlay) this.invOverlay.classList.remove('show');
  }

  renderInventory() {
    const list = document.getElementById('inv-list');
    if (!list) return;
    const items = this.state.list();
    if (!items.length) {
      list.innerHTML = `<div class="inv-empty">Noch keine Items – tippe auf „Code einlösen“ und probier einen Code!</div>`;
      return;
    }
    list.innerHTML = items
      .map(
        (it) => `
      <div class="inv-item" style="--chip:${it.color}">
        <span class="inv-emoji">${it.emoji}</span>
        <span class="inv-meta"><b>${it.name}</b><span class="inv-rar">${it.rarity}</span></span>
        ${it.count > 1 ? `<span class="inv-count">×${it.count}</span>` : ''}
      </div>`
      )
      .join('');
  }

  updateStats() {
    const total = document.getElementById('stat-total');
    if (total) total.textContent = String(this.state.totalItems());
  }

  // --- Info ----------------------------------------------------------------
  _wireInfo() {
    this.infoOverlay = document.getElementById('info-overlay');
    const openBtn = document.getElementById('info-btn');
    const closeBtn = document.getElementById('info-close');
    if (openBtn) openBtn.addEventListener('click', () => this.openInfo());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeInfo());
    if (this.infoOverlay)
      this.infoOverlay.addEventListener('click', (e) => {
        if (e.target === this.infoOverlay) this.closeInfo();
      });
  }
  openInfo() {
    if (this.infoOverlay) this.infoOverlay.classList.add('show');
  }
  closeInfo() {
    if (this.infoOverlay) this.infoOverlay.classList.remove('show');
  }

  // --- Toast ---------------------------------------------------------------
  toast(text, color) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.style.setProperty('--chip', color || '#5bb04a');
    el.classList.add('show');
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // --- Rendering -----------------------------------------------------------
  resize() {
    const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.cssW = window.innerWidth;
    this.cssH = window.innerHeight;
    this.canvas.width = Math.max(1, Math.round(this.cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(this.cssH * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawOnce();
  }

  // Avatar-Zubehör aus dem Inventar an die Welt spiegeln (für den Renderer).
  _syncAvatar() {
    this.world.hasKrone = this.state.has('krone');
    this.world.hasHut = this.state.has('hut');
    this.world.pet = this.state.has('haustier_drache')
      ? '🐉'
      : this.state.has('haustier_hund')
      ? '🐶'
      : null;
  }

  drawOnce() {
    this._syncAvatar();
    const t = performance.now() / 1000;
    drawWorld(this.ctx, this.cssW, this.cssH, this.world, this.state.list(), t);
  }

  loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - this._last) / 1000));
    this._last = now;
    this.world.update(dt, this.readControls());
    if (this.world.respawnCount !== this._lastRespawn) {
      this._lastRespawn = this.world.respawnCount;
      this.toast('💦 Zurück am Brunnen!', '#3aa6e0');
    }
    if (this.world.reachedGoal) {
      this.world.reachedGoal = false;
      this.onObbyComplete();
    }
    this._syncAvatar();
    drawWorld(this.ctx, this.cssW, this.cssH, this.world, this.state.list(), now / 1000);
    requestAnimationFrame((n) => this.loop(n));
  }

  frameIsBlank() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w < 2 || h < 2) return true;
    const d = this.ctx.getImageData(0, 0, w, h).data;
    const r0 = d[0], g0 = d[1], b0 = d[2];
    for (let i = 0; i < d.length; i += 4 * 131) {
      if (Math.abs(d[i] - r0) > 10 || Math.abs(d[i + 1] - g0) > 10 || Math.abs(d[i + 2] - b0) > 10) {
        return false;
      }
    }
    return true;
  }
}

// --- Start ---
const game = new Game();

// Test-/Debug-API für deterministische Playwright-/Node-Tests.
window.CodeGartenTest = {
  get ready() {
    return game.ready;
  },
  game,
  reset() {
    game.state.reset();
    game.world.reset();
    game._lastRespawn = 0;
    game._rewardCode = null;
    game.closeObby();
    game.closeCode();
    game.closeInventory();
    game.renderInventory();
    game.updateStats();
    const res = document.getElementById('code-result');
    if (res) res.hidden = true;
    return game.state.snapshot();
  },
  redeem(code) {
    return game.onRedeem(code);
  },
  getInventory() {
    return game.state.list();
  },
  snapshot() {
    return game.state.snapshot();
  },
  has(id) {
    return game.state.has(id);
  },
  totalItems() {
    return game.state.totalItems();
  },
  exampleCodes() {
    return game.state.exampleCodes().map((e) => e.code);
  },
  getPlayer() {
    return game.world.snapshot();
  },
  // Position der Ziel-Plattform (für Tests).
  goalPos() {
    const g = game.world.obbyPoses().find((s) => s.kind === 'goal');
    return g ? { x: g.x, z: g.z, top: g.top } : null;
  },
  // Bewegung deterministisch simulieren (für Tests).
  tick(controls = {}, dt = 0.1, steps = 1) {
    for (let i = 0; i < steps; i++) game.world.update(dt, controls);
    return game.world.snapshot();
  },
  // Avatar für Tests an eine Position setzen.
  place(x, z, y = 0) {
    game.world.x = x;
    game.world.z = z;
    game.world.y = y;
    game.world.vy = 0;
    game.world.grounded = false;
    return game.world.snapshot();
  },
  turn(delta) {
    game.world.applyTurn(delta);
    return game.world.snapshot();
  },
  openPanel() {
    game.openCode();
    return game.codeOverlay ? game.codeOverlay.classList.contains('show') : false;
  },
  closePanel() {
    game.closeCode();
    return false;
  },
  openInventory() {
    game.openInventory();
    return game.invOverlay ? game.invOverlay.classList.contains('show') : false;
  },
  frame() {
    game.drawOnce();
    return true;
  },
  canvasIsBlank() {
    return game.frameIsBlank();
  },
};

try {
  game.init();
} catch (err) {
  console.error('Init-Fehler:', err);
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = 'Fehler beim Laden: ' + err;
}
