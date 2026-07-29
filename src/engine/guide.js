// Baut die Spielanleitung als HTML – direkt aus den echten Spiel-Daten
// (Klassen, Rohstoffe, Viertel, Gegnerwerte, aktueller Heldenzustand).
// Dadurch ist der Inhalt immer aktuell. Render-nah (liefert HTML-String).

import { CLASSES, RESOURCES, MAX_LEVEL, RESOURCES_PER_LEVEL } from '../logic/classes.js';
import { VIERTEL } from '../logic/viertel.js';
import { ENEMY_TYPES } from '../logic/entities.js';

function esc(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function dot(color) {
  return `<span class="g-dot" style="background:${color}"></span>`;
}

export function buildGuideHtml(state) {
  const s = state.snapshot();
  const p = s.player;

  const classRows = CLASSES.map((c) => {
    const res = RESOURCES[c.resource];
    const active = c.id === s.class.id ? ' class="g-active"' : '';
    return `<li${active}>${dot(c.color)}<b>${esc(c.name)}</b> — ${esc(c.ability)}
      <span class="g-sub">sammelt ${dot(res.color)}${esc(res.name)}</span></li>`;
  }).join('');

  const viertelRows = Object.values(VIERTEL)
    .map(
      (v) =>
        `<li><b>${esc(v.name)}</b>${v.danger ? ' <span class="g-danger">⚔ gefährlich</span>' : ' <span class="g-sub">ruhig</span>'}</li>`
    )
    .join('');

  const enemyRows = ENEMY_TYPES.map(
    (e) => `<li><b>${esc(e.name)}</b> — Leben ${e.baseHp}–${e.baseHp + 4}, Stärke ${e.strength}</li>`
  ).join('');

  const resRow = s.resources
    .map((r) => `${dot(r.color)}<b>${r.count}</b> ${esc(r.name)}`)
    .join(' &nbsp; ');

  return `
    <h1>Spielanleitung</h1>
    <p class="g-lead">Steige bis zur <b>Meister-Stufe ${MAX_LEVEL}</b> auf: Sammle Rohstoffe im Labyrinth
      und bring immer <b>${RESOURCES_PER_LEVEL} gildeneigene Rohstoffe</b> zum <b>Händler</b>.</p>

    <h2>Dein Held gerade</h2>
    <ul class="g-stats">
      <li>Klasse <b>${esc(s.class.name)}</b> ${dot(s.class.color)}</li>
      <li>Stufe <b>${p.level}/${s.maxLevel}</b></li>
      <li>Leben <b>${p.hp}/${p.maxHp}</b> · Stärke <b>${p.strength}</b></li>
      <li>Stufenkarte: <b>${s.guild.have}/${s.guild.need}</b> ${esc(s.class.resourceName)} für die nächste Stufe</li>
      <li>Aktuelles Viertel: <b>${esc(s.viertelName)}</b></li>
      <li>Vorrat: ${resRow}</li>
    </ul>

    <h2>Klassen</h2>
    <ul class="g-classes">${classRows}</ul>

    <h2>Rohstoffe &amp; Stufenkarten</h2>
    <ul>
      <li>Rohstoffe liegen im Labyrinth und fallen von besiegten Kobolden.</li>
      <li>Zum Aufsteigen brauchst du <b>${RESOURCES_PER_LEVEL} Rohstoffe deiner Gilde</b> (${dot(RESOURCES[s.class.resource].color)}${esc(s.class.resourceName)}).</li>
      <li>Der <b>Händler</b> (goldenes Feld auf der Karte) nimmt sie an und tauscht auch: <b>2 fremde → 1 eigener</b> Rohstoff.</li>
    </ul>

    <h2>Die Viertel</h2>
    <ul class="g-viertel">${viertelRows}</ul>

    <h2>Kampf</h2>
    <ul>
      <li>Gegner findest du in Katakomben &amp; Mechanikerviertel.</li>
      <li>Dein Schaden = <b>Stärke + Zufall (0–3)</b>; besiegte Gegner geben einen Rohstoff.</li>
      <li>Mit <b>Fliehen</b> brichst du den Kampf ab.</li>
    </ul>

    <h2>Gegner</h2>
    <ul class="g-enemies">${enemyRows}</ul>

    <h2>Steuerung</h2>
    <div class="g-cols">
      <div><h3>Computer</h3><ul>
        <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / Pfeile — bewegen</li>
        <li>Maus ziehen — umsehen</li>
        <li><kbd>Leertaste</kbd> — Nehmen / Händler</li>
        <li><kbd>F</kbd> — Angreifen · <kbd>R</kbd> — Neustart</li>
      </ul></div>
      <div><h3>Handy</h3><ul>
        <li>Joystick — bewegen</li>
        <li>Wischen — umsehen</li>
        <li>Knöpfe — Nehmen / Angreifen / Fliehen</li>
      </ul></div>
    </div>

    <p class="g-tip">Tipp: Tippe auf die <b>Minikarte</b>, um sie groß anzuzeigen.</p>
  `;
}
