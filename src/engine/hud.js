// HUD-Aktualisierung (deutsch) aus dem GameState. Render-Layer: DOM.
// Erwartet die im index.html definierten Elemente.

export class Hud {
  constructor(root = document) {
    this.el = {
      level: root.getElementById('hud-level'),
      strength: root.getElementById('hud-strength'),
      hpBar: root.getElementById('hud-hp-bar'),
      hpText: root.getElementById('hud-hp-text'),
      xpBar: root.getElementById('hud-xp-bar'),
      xpText: root.getElementById('hud-xp-text'),
      cards: root.getElementById('hud-cards'),
      message: root.getElementById('hud-message'),
      // Kampf
      combat: root.getElementById('combat-overlay'),
      combatName: root.getElementById('combat-enemy-name'),
      combatHpBar: root.getElementById('combat-enemy-hp-bar'),
      combatHpText: root.getElementById('combat-enemy-hp-text'),
      // Ende
      end: root.getElementById('end-overlay'),
      endTitle: root.getElementById('end-title'),
      endText: root.getElementById('end-text'),
    };
    this._lastMsg = null;
  }

  update(state) {
    const s = state.snapshot();
    const p = s.player;

    if (this.el.level) this.el.level.textContent = String(p.level);
    if (this.el.strength) this.el.strength.textContent = String(p.strength);

    if (this.el.hpBar) this.el.hpBar.style.width = `${(p.hp / p.maxHp) * 100}%`;
    if (this.el.hpText) this.el.hpText.textContent = `${p.hp}/${p.maxHp}`;

    if (this.el.xpBar) this.el.xpBar.style.width = `${(p.xp / p.xpToNext) * 100}%`;
    if (this.el.xpText) this.el.xpText.textContent = `${p.xp}/${p.xpToNext}`;

    if (this.el.cards) this.el.cards.textContent = `${s.collected}/${s.totalCards}`;

    if (this.el.message && s.message !== this._lastMsg) {
      this.el.message.textContent = s.message;
      this._lastMsg = s.message;
      // kurze Einblend-Animation neu auslösen
      this.el.message.classList.remove('flash');
      // reflow, damit die Animation erneut startet
      void this.el.message.offsetWidth;
      this.el.message.classList.add('flash');
    }

    // Kampf-Overlay
    if (this.el.combat) {
      if (state.mode === 'combat' && state.combatEnemy) {
        const e = state.combatEnemy;
        this.el.combat.classList.add('show');
        if (this.el.combatName) this.el.combatName.textContent = e.name;
        if (this.el.combatHpBar)
          this.el.combatHpBar.style.width = `${(e.hp / e.maxHp) * 100}%`;
        if (this.el.combatHpText) this.el.combatHpText.textContent = `${e.hp}/${e.maxHp}`;
      } else {
        this.el.combat.classList.remove('show');
      }
    }

    // Ende-Overlay (Sieg / Niederlage)
    if (this.el.end) {
      if (state.mode === 'win' || state.mode === 'gameover') {
        this.el.end.classList.add('show');
        const win = state.mode === 'win';
        if (this.el.endTitle) this.el.endTitle.textContent = win ? 'Gewonnen!' : 'Besiegt';
        if (this.el.endText)
          this.el.endText.textContent = win
            ? `Du hast alle ${s.totalCards} Karten gesammelt. Stufe ${p.level}!`
            : 'Die Kobolde waren zu stark. Versuch es noch einmal!';
      } else {
        this.el.end.classList.remove('show');
      }
    }
  }
}
