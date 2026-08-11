// HUD-Aktualisierung (deutsch) aus dem GameState. Render-Layer: DOM.
// Zeigt Leben, Klasse, aktuelle Stufenkarte (Gilden-Rohstoffe X/5),
// Rohstoff-Vorrat und aktuelles Viertel.

import { SVGS } from '../assets/svg.js';
import { getClass } from '../logic/classes.js';

export class Hud {
  constructor(root = document) {
    const g = (id) => root.getElementById(id);
    this.el = {
      hpBar: g('hud-hp-bar'),
      hpText: g('hud-hp-text'),
      guildIcon: g('hud-guild-icon'),
      guildBar: g('hud-guild-bar'),
      guildText: g('hud-guild-text'),
      level: g('hud-level'),
      classIcon: g('hud-class-icon'),
      className: g('hud-class'),
      viertel: g('hud-viertel'),
      armor: g('hud-armor'),
      keys: g('hud-keys'),
      questChip: g('hud-quest-chip'),
      quest: g('hud-quest'),
      res: g('hud-res'),
      message: g('hud-message'),
      combat: g('combat-overlay'),
      combatName: g('combat-enemy-name'),
      combatHpBar: g('combat-enemy-hp-bar'),
      combatHpText: g('combat-enemy-hp-text'),
      end: g('end-overlay'),
      endTitle: g('end-title'),
      endText: g('end-text'),
    };
    this._lastMsg = null;
    this._classId = null;
    this._resSig = null;
  }

  update(state) {
    const s = state.snapshot();
    const p = s.player;

    // Klassen-/Gilden-Icons nur bei Wechsel neu setzen.
    if (this._classId !== s.class.id) {
      this._classId = s.class.id;
      const cls = getClass(s.class.id);
      if (this.el.classIcon) this.el.classIcon.innerHTML = SVGS[cls.icon] || '';
      if (this.el.guildIcon) this.el.guildIcon.innerHTML = SVGS['res_' + s.class.resource] || '';
    }
    if (this.el.className) this.el.className.textContent = s.class.name;

    if (this.el.hpBar) this.el.hpBar.style.width = `${(p.hp / p.maxHp) * 100}%`;
    if (this.el.hpText) this.el.hpText.textContent = `${p.hp}/${p.maxHp}`;

    if (this.el.guildBar) {
      this.el.guildBar.style.width = `${(s.guild.have / s.guild.need) * 100}%`;
      this.el.guildBar.style.background = s.class.color;
    }
    if (this.el.guildText) this.el.guildText.textContent = `${s.guild.have}/${s.guild.need}`;

    if (this.el.level) this.el.level.textContent = `${p.level}/${s.maxLevel}`;
    if (this.el.viertel) this.el.viertel.textContent = s.viertelName;
    if (this.el.armor) this.el.armor.textContent = String(s.equip.armorTier);
    if (this.el.keys) this.el.keys.textContent = String(s.keys);

    // Auftrags-Chip (nur wenn ein Auftrag aktiv ist).
    if (this.el.questChip) {
      if (s.quest) {
        this.el.questChip.hidden = false;
        const done = s.quest.done ? ' ✓' : ` ${s.quest.progress}/${s.quest.target}`;
        if (this.el.quest) this.el.quest.textContent = `${s.quest.text}${done}`;
      } else {
        this.el.questChip.hidden = true;
      }
    }

    // Rohstoff-Vorrat (nur bei Änderung neu bauen).
    const sig = s.resources.map((r) => r.count).join(',');
    if (this.el.res && sig !== this._resSig) {
      this._resSig = sig;
      this.el.res.innerHTML = s.resources
        .map(
          (r) =>
            `<span class="res-chip"><span class="res-dot" style="background:${r.color}"></span>${r.count}</span>`
        )
        .join('');
    }

    if (this.el.message && s.message !== this._lastMsg) {
      this.el.message.textContent = s.message;
      this._lastMsg = s.message;
      this.el.message.classList.remove('flash');
      void this.el.message.offsetWidth;
      this.el.message.classList.add('flash');
    }

    // Kampf-Overlay
    if (this.el.combat) {
      if (state.mode === 'combat' && state.combatEnemy) {
        const e = state.combatEnemy;
        this.el.combat.classList.add('show');
        if (this.el.combatName) this.el.combatName.textContent = e.name;
        if (this.el.combatHpBar) this.el.combatHpBar.style.width = `${(e.hp / e.maxHp) * 100}%`;
        if (this.el.combatHpText) this.el.combatHpText.textContent = `${e.hp}/${e.maxHp}`;
      } else {
        this.el.combat.classList.remove('show');
      }
    }

    // Ende-Overlay
    if (this.el.end) {
      if (state.mode === 'win' || state.mode === 'gameover') {
        this.el.end.classList.add('show');
        const win = state.mode === 'win';
        if (this.el.endTitle) this.el.endTitle.textContent = win ? 'Meister!' : 'Besiegt';
        if (this.el.endText)
          this.el.endText.textContent = win
            ? `Du hast als ${s.class.name} die Meister-Stufe ${p.level} erreicht!`
            : 'Die Kobolde waren zu stark. Versuch es noch einmal!';
      } else {
        this.el.end.classList.remove('show');
      }
    }
  }
}
