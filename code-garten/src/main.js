// Bootstrap für Code-Garten: verbindet den Spielzustand mit der Rasen-Szene und
// der DOM-Oberfläche (Seiten-Knopf, Einlöse-Fenster, Inventar). Installiert die
// Test-API window.CodeGartenTest für automatisierte Tests.

import { GameState } from './logic/gamestate.js';
import { drawScene } from './engine/scene.js';

const DPR_CAP = 2;

class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.state = new GameState();
    this.ready = false;
    this.dpr = 1;
    this.cssW = 1;
    this.cssH = 1;
    this._start = 0;
    this._toastTimer = null;
  }

  init() {
    this._wireCodePanel();
    this._wireInfo();
    this._buildExamples();
    this.renderInventory();
    this.updateStats();

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeCode();
        this.closeInfo();
      }
    });

    this.resize();

    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');

    this.ready = true;
    this._start = performance.now();
    this.loop(this._start);
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

  _buildExamples() {
    const box = document.getElementById('code-examples');
    if (!box) return;
    box.innerHTML = '';
    for (const { code, item } of this.state.exampleCodes()) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.style.setProperty('--chip', item ? item.color : '#888');
      chip.innerHTML = `<span>${item ? item.emoji : '🎁'}</span> ${code}`;
      chip.addEventListener('click', () => {
        if (this.input) this.input.value = code;
        this.onRedeem(code);
      });
      box.appendChild(chip);
    }
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

  // --- Inventar & Kopfzeile -----------------------------------------------
  renderInventory() {
    const bar = document.getElementById('inv-bar');
    if (!bar) return;
    const items = this.state.list();
    if (!items.length) {
      bar.innerHTML = `<div class="inv-empty">Noch keine Items – tippe auf „Code einlösen“ und probier einen Code!</div>`;
      return;
    }
    bar.innerHTML = items
      .map(
        (it) => `
      <div class="inv-item" style="--chip:${it.color}" title="${it.name} · ${it.rarity}">
        <span class="inv-emoji">${it.emoji}</span>
        <span class="inv-name">${it.name}</span>
        ${it.count > 1 ? `<span class="inv-count">×${it.count}</span>` : ''}
      </div>`
      )
      .join('');
  }

  updateStats() {
    const total = document.getElementById('stat-total');
    if (total) total.textContent = String(this.state.totalItems());
  }

  // --- Info-Fenster --------------------------------------------------------
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

  drawOnce() {
    const now = performance.now();
    const t = (now - (this._start || now)) / 1000;
    drawScene(this.ctx, this.cssW, this.cssH, this.state, t);
  }

  loop(now) {
    const t = (now - this._start) / 1000;
    drawScene(this.ctx, this.cssW, this.cssH, this.state, t);
    requestAnimationFrame((n) => this.loop(n));
  }

  // Prüft, ob das aktuelle Canvas quasi einfarbig (leer) ist – für Tests.
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

// Test-/Debug-API für deterministische Playwright-Tests.
window.CodeGartenTest = {
  get ready() {
    return game.ready;
  },
  game,
  reset() {
    game.state.reset();
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
  openPanel() {
    game.openCode();
    return game.codeOverlay ? game.codeOverlay.classList.contains('show') : false;
  },
  closePanel() {
    game.closeCode();
    return false;
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
