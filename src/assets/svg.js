// Selbst geschriebene SVG-Grafiken für Tammo Stadt.
// Ausschließlich <rect>/<path>/<circle>/<polygon> mit eigenen Farben – keine
// externen Bilder, keine Web-Fonts, keine fremden Assets. 100 % lizenzfrei.
//
// Wände sind vollflächig (Textur), Sprites/Karten haben transparenten Grund.

import { palette as P } from './palette.js';

// ---------------------------------------------------------------------------
// Wand-Texturen (64x64, kachelbar). Backstein-Optik in zwei Varianten.
// ---------------------------------------------------------------------------
function brickWall(light, mid, dark) {
  // Zwei versetzte Ziegelreihen.
  const mortar = dark;
  let bricks = '';
  const bw = 32;
  const bh = 16;
  for (let row = 0; row < 4; row++) {
    const offset = row % 2 === 0 ? 0 : -bw / 2;
    for (let col = -1; col < 3; col++) {
      const x = col * bw + offset + 1;
      const y = row * bh + 1;
      bricks += `<rect x="${x}" y="${y}" width="${bw - 2}" height="${bh - 2}" rx="2" fill="${mid}"/>`;
      // kleiner Glanz oben
      bricks += `<rect x="${x}" y="${y}" width="${bw - 2}" height="3" rx="2" fill="${light}" opacity="0.5"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect width="64" height="64" fill="${mortar}"/>
    ${bricks}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Kobold-Sprites (transparenter Grund). Kleiner grüner Wicht.
// ---------------------------------------------------------------------------
function goblin(scale = 1) {
  const s = scale;
  const cx = 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <g transform="translate(${cx},34) scale(${s})">
      <!-- Körper -->
      <ellipse cx="0" cy="4" rx="15" ry="17" fill="${P.goblinSkin}"/>
      <ellipse cx="0" cy="4" rx="15" ry="17" fill="none" stroke="${P.goblinSkinDark}" stroke-width="2"/>
      <!-- Bauchtuch -->
      <path d="M -13 8 Q 0 20 13 8 L 13 20 Q 0 26 -13 20 Z" fill="${P.goblinCloth}"/>
      <!-- Ohren -->
      <path d="M -14 -6 L -26 -14 L -16 -2 Z" fill="${P.goblinSkin}" stroke="${P.goblinSkinDark}" stroke-width="1.5"/>
      <path d="M 14 -6 L 26 -14 L 16 -2 Z" fill="${P.goblinSkin}" stroke="${P.goblinSkinDark}" stroke-width="1.5"/>
      <!-- Augen -->
      <circle cx="-6" cy="-2" r="4.5" fill="${P.goblinEye}"/>
      <circle cx="6" cy="-2" r="4.5" fill="${P.goblinEye}"/>
      <circle cx="-6" cy="-2" r="2" fill="#1a1a1a"/>
      <circle cx="6" cy="-2" r="2" fill="#1a1a1a"/>
      <!-- Nase -->
      <path d="M 0 0 L -3 6 L 3 6 Z" fill="${P.goblinSkinDark}"/>
      <!-- Mund mit Zähnen -->
      <path d="M -7 10 Q 0 15 7 10" fill="none" stroke="${P.goblinSkinDark}" stroke-width="2"/>
      <polygon points="-4,10 -2,14 0,10" fill="#fff"/>
      <polygon points="4,10 2,14 0,10" fill="#fff"/>
    </g>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Sammelkarten-Sprites (transparenter Grund). Pergamentkarte mit Symbol.
// ---------------------------------------------------------------------------
function symbolFor(kind) {
  switch (kind) {
    case 'card_pilz': // Pilzkobold
      return `<path d="M 32 40 Q 22 40 22 28 Q 22 18 32 18 Q 42 18 42 28 Q 42 40 32 40 Z" fill="#c0392b"/>
              <circle cx="27" cy="26" r="2.5" fill="#fff"/><circle cx="36" cy="24" r="2" fill="#fff"/>
              <rect x="29" y="38" width="6" height="12" rx="2" fill="#efe4c8" stroke="#b9a06b"/>`;
    case 'card_moos': // Moosgeist
      return `<circle cx="32" cy="30" r="12" fill="#4d7c3a"/>
              <circle cx="27" cy="27" r="2.5" fill="#dff5c0"/><circle cx="37" cy="27" r="2.5" fill="#dff5c0"/>
              <path d="M 26 36 Q 32 40 38 36" fill="none" stroke="#dff5c0" stroke-width="2"/>`;
    case 'card_funke': // Funkenkäfer
      return `<ellipse cx="32" cy="32" rx="10" ry="13" fill="#3a3f5a"/>
              <line x1="32" y1="20" x2="32" y2="44" stroke="#f6c453" stroke-width="2"/>
              <circle cx="32" cy="18" r="5" fill="#f6c453"/>
              <path d="M 22 26 L 12 20 M 42 26 L 52 20" stroke="#f6c453" stroke-width="2"/>`;
    case 'card_kristall': // Kristalldrache
      return `<polygon points="32,16 42,30 37,46 27,46 22,30" fill="#4f9df6" stroke="#2b6fd0" stroke-width="2"/>
              <polygon points="32,16 32,46 22,30" fill="#7bbaf9"/>`;
    case 'card_schatten': // Schattenwicht
      return `<path d="M 32 18 Q 44 20 42 36 Q 40 48 32 48 Q 24 48 22 36 Q 20 20 32 18 Z" fill="#3a2f4a"/>
              <circle cx="27" cy="30" r="3" fill="#a855f7"/><circle cx="37" cy="30" r="3" fill="#a855f7"/>`;
    case 'card_gold': // Goldkönig
    default:
      return `<polygon points="20,42 24,26 32,34 40,26 44,42" fill="#f6c453" stroke="#c99a2e" stroke-width="2"/>
              <circle cx="24" cy="24" r="3" fill="#f6c453"/><circle cx="32" cy="32" r="3" fill="#f6c453"/><circle cx="40" cy="24" r="3" fill="#f6c453"/>`;
  }
}

function card(kind, rarityColor) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <g transform="translate(6,4)">
      <rect x="0" y="0" width="52" height="56" rx="6" fill="${P.cardParchment}" stroke="${rarityColor}" stroke-width="3"/>
      <rect x="5" y="5" width="42" height="46" rx="3" fill="none" stroke="${P.cardEdge}" stroke-width="1"/>
      ${symbolFor(kind)}
    </g>
  </svg>`;
}

// Kartenrückseite (z. B. für Sammel-Übersicht, noch nicht gefunden).
function cardBack() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <g transform="translate(6,4)">
      <rect x="0" y="0" width="52" height="56" rx="6" fill="${P.stoneMid}" stroke="${P.stoneDark}" stroke-width="3"/>
      <text x="26" y="38" font-size="30" fill="${P.stoneDark}" text-anchor="middle" font-family="system-ui,sans-serif">?</text>
    </g>
  </svg>`;
}

// ---------------------------------------------------------------------------
// HUD-Icons (transparenter Grund).
// ---------------------------------------------------------------------------
function heartIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <path d="M12 21 C 4 14 3 8 7 6 C 10 4.5 12 8 12 8 C 12 8 14 4.5 17 6 C 21 8 20 14 12 21 Z" fill="${P.hpRed}"/>
  </svg>`;
}
function starIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" fill="${P.xpBlue}"/>
  </svg>`;
}
function swordIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <path d="M4 20 L6 18 L14 10 L16 4 L18 6 L12 14 L4 22 Z" fill="${P.stoneLight}"/>
    <rect x="3" y="17" width="4" height="4" transform="rotate(45 5 19)" fill="${P.gold}"/>
  </svg>`;
}
function cardsIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <rect x="4" y="6" width="11" height="14" rx="2" fill="${P.cardParchment}" stroke="${P.cardEdge}" transform="rotate(-8 9 13)"/>
    <rect x="9" y="4" width="11" height="14" rx="2" fill="${P.gold}" stroke="${P.goldDark}"/>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Export: benannte SVG-Strings + Zuordnung Wand-ID -> Textur.
// ---------------------------------------------------------------------------
export const SVGS = {
  wall_stone: brickWall(P.stoneLight, P.stoneMid, P.stoneDark),
  wall_moss: brickWall(P.mossLight, P.mossMid, P.mossDark),
  goblin: goblin(1),
  goblin_gross: goblin(1.25),
  card_pilz: card('card_pilz', P.rarity['gewöhnlich']),
  card_moos: card('card_moos', P.rarity['gewöhnlich']),
  card_funke: card('card_funke', P.rarity['selten']),
  card_kristall: card('card_kristall', P.rarity['selten']),
  card_schatten: card('card_schatten', P.rarity['episch']),
  card_gold: card('card_gold', P.rarity['legendär']),
  card_back: cardBack(),
  icon_heart: heartIcon(),
  icon_star: starIcon(),
  icon_sword: swordIcon(),
  icon_cards: cardsIcon(),
};

// Wand-Textur-ID (aus maze.js) -> SVG-Schlüssel.
export const WALL_TEXTURES = {
  1: 'wall_stone',
  2: 'wall_moss',
};

// Kleiner Helfer: SVG-String -> Data-URL (für <img>/Texturen).
export function svgToDataUrl(svg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
