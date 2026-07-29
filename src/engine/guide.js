// Baut die Spielanleitung als HTML – direkt aus den echten Spiel-Daten
// (Kartendefinitionen, Gegnerwerte, aktueller Heldenzustand). Dadurch ist der
// Inhalt immer aktuell: Ändert sich die Logik, ändert sich automatisch der Text.
// Render-nah (liefert HTML-String, kein direkter DOM-Zugriff).

import { CARD_DEFS, ENEMY_TYPES } from '../logic/entities.js';
import { palette as P } from '../assets/palette.js';

function esc(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export function buildGuideHtml(state) {
  const s = state.snapshot();
  const p = state.player;
  const totalCards = CARD_DEFS.length;

  const cardRows = CARD_DEFS.map((c) => {
    const got = state.inventory.has(c.id);
    const color = P.rarity[c.rarity] || P.textDim;
    return `<li>
      <span class="g-dot" style="background:${color}"></span>
      <b>${esc(c.name)}</b>
      <span class="g-rar" style="color:${color}">${esc(c.rarity)}</span>
      <span class="g-tag ${got ? 'got' : ''}">${got ? '✓ gefunden' : 'noch offen'}</span>
    </li>`;
  }).join('');

  const enemyRows = ENEMY_TYPES.map(
    (e) =>
      `<li><b>${esc(e.name)}</b> — Leben ${e.baseHp}–${e.baseHp + 4}, Stärke ${e.strength}, ${e.xpReward} EP</li>`
  ).join('');

  return `
    <h1>Spielanleitung</h1>
    <p class="g-lead">Finde alle <b>${totalCards} Sammelkarten</b> im Labyrinth, ohne von den Kobolden besiegt zu werden.</p>

    <h2>Dein Held gerade</h2>
    <ul class="g-stats">
      <li>Stufe <b>${p.level}</b></li>
      <li>Leben <b>${p.hp}/${p.maxHp}</b></li>
      <li>Stärke <b>${p.strength}</b></li>
      <li>Erfahrung <b>${p.xp}/${p.xpToNext}</b> bis zur nächsten Stufe</li>
      <li>Karten <b>${s.collected}/${totalCards}</b> · Gegner übrig <b>${s.enemyCount}</b></li>
    </ul>

    <h2>Steuerung</h2>
    <div class="g-cols">
      <div>
        <h3>Computer</h3>
        <ul>
          <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / Pfeile — bewegen</li>
          <li>Maus ziehen — umsehen</li>
          <li><kbd>Leertaste</kbd> — Nehmen</li>
          <li><kbd>F</kbd> — Angreifen</li>
          <li><kbd>R</kbd> — Neustart</li>
        </ul>
      </div>
      <div>
        <h3>Handy</h3>
        <ul>
          <li>Joystick — bewegen</li>
          <li>Wischen — umsehen</li>
          <li>Knöpfe — Nehmen / Angreifen / Fliehen</li>
        </ul>
      </div>
    </div>

    <h2>Sammelkarten</h2>
    <ul class="g-cards">${cardRows}</ul>

    <h2>Gegner</h2>
    <ul class="g-enemies">${enemyRows}</ul>

    <h2>Kampf</h2>
    <ul>
      <li>Gehe nah an einen Gegner und <b>greife an</b>.</li>
      <li>Dein Schaden = <b>Stärke + Zufall (0–3)</b>.</li>
      <li>Überlebt der Gegner, schlägt er zurück.</li>
      <li>Mit <b>Fliehen</b> brichst du den Kampf ab.</li>
    </ul>

    <h2>Stärker werden</h2>
    <ul>
      <li>Besiegte Gegner geben <b>Erfahrung</b>.</li>
      <li>Beim <b>Stufenaufstieg</b>: +5 Leben, +1 Stärke und volle Heilung.</li>
      <li>Die nächste Stufe braucht gerade <b>${p.xpToNext} EP</b> (steigt mit jeder Stufe).</li>
    </ul>

    <p class="g-tip">Tipp: Tippe auf die <b>Minikarte</b>, um sie groß anzuzeigen.</p>
  `;
}
