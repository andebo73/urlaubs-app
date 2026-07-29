// Selbst geschriebene SVG-Grafiken für Tammo Stadt.
// Ausschließlich <rect>/<path>/<circle>/<polygon> mit eigenen Farben – keine
// externen Bilder, keine Web-Fonts, keine fremden Assets. 100 % lizenzfrei.
//
// Wände sind vollflächig (Textur), Sprites/Icons haben transparenten Grund.

import { palette as P } from './palette.js';
import { RESOURCES } from '../logic/classes.js';

// ---------------------------------------------------------------------------
// Wand-Texturen (64x64, kachelbar) – je Viertel eine Variante.
// ---------------------------------------------------------------------------
function brickWall(light, mid, dark) {
  let bricks = '';
  const bw = 32;
  const bh = 16;
  for (let row = 0; row < 4; row++) {
    const offset = row % 2 === 0 ? 0 : -bw / 2;
    for (let col = -1; col < 3; col++) {
      const x = col * bw + offset + 1;
      const y = row * bh + 1;
      bricks += `<rect x="${x}" y="${y}" width="${bw - 2}" height="${bh - 2}" rx="2" fill="${mid}"/>`;
      bricks += `<rect x="${x}" y="${y}" width="${bw - 2}" height="3" rx="2" fill="${light}" opacity="0.5"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect width="64" height="64" fill="${dark}"/>${bricks}</svg>`;
}

// Metallwand (Mechanikerviertel): Platten mit Nieten.
function metalWall(light, mid, dark) {
  let rivets = '';
  for (const [cx, cy] of [[8, 8], [56, 8], [8, 56], [56, 56], [32, 32]]) {
    rivets += `<circle cx="${cx}" cy="${cy}" r="3" fill="${light}"/><circle cx="${cx}" cy="${cy}" r="1.4" fill="${dark}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect width="64" height="64" fill="${mid}"/>
    <rect x="2" y="2" width="60" height="60" rx="4" fill="none" stroke="${dark}" stroke-width="3"/>
    <line x1="32" y1="2" x2="32" y2="62" stroke="${dark}" stroke-width="2"/>
    <rect x="4" y="4" width="56" height="6" fill="${light}" opacity="0.25"/>
    ${rivets}</svg>`;
}

// ---------------------------------------------------------------------------
// Kobold-Sprites (transparenter Grund).
// ---------------------------------------------------------------------------
function goblin(scale = 1) {
  const s = scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <g transform="translate(32,34) scale(${s})">
      <ellipse cx="0" cy="4" rx="15" ry="17" fill="${P.goblinSkin}"/>
      <ellipse cx="0" cy="4" rx="15" ry="17" fill="none" stroke="${P.goblinSkinDark}" stroke-width="2"/>
      <path d="M -13 8 Q 0 20 13 8 L 13 20 Q 0 26 -13 20 Z" fill="${P.goblinCloth}"/>
      <path d="M -14 -6 L -26 -14 L -16 -2 Z" fill="${P.goblinSkin}" stroke="${P.goblinSkinDark}" stroke-width="1.5"/>
      <path d="M 14 -6 L 26 -14 L 16 -2 Z" fill="${P.goblinSkin}" stroke="${P.goblinSkinDark}" stroke-width="1.5"/>
      <circle cx="-6" cy="-2" r="4.5" fill="${P.goblinEye}"/>
      <circle cx="6" cy="-2" r="4.5" fill="${P.goblinEye}"/>
      <circle cx="-6" cy="-2" r="2" fill="#1a1a1a"/>
      <circle cx="6" cy="-2" r="2" fill="#1a1a1a"/>
      <path d="M 0 0 L -3 6 L 3 6 Z" fill="${P.goblinSkinDark}"/>
      <path d="M -7 10 Q 0 15 7 10" fill="none" stroke="${P.goblinSkinDark}" stroke-width="2"/>
      <polygon points="-4,10 -2,14 0,10" fill="#fff"/>
      <polygon points="4,10 2,14 0,10" fill="#fff"/>
    </g>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Händler-Sprite (transparenter Grund): freundliche Kapuzenfigur mit Münze.
// ---------------------------------------------------------------------------
function haendler() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <g transform="translate(32,32)">
      <!-- Umhang -->
      <path d="M -16 26 Q -18 -6 0 -20 Q 18 -6 16 26 Z" fill="#7a5230" stroke="#4e3420" stroke-width="2"/>
      <!-- Kapuze -->
      <path d="M -13 -6 Q 0 -26 13 -6 Q 0 -14 -13 -6 Z" fill="#5e3f24"/>
      <!-- Gesicht -->
      <circle cx="0" cy="-4" r="8" fill="#e9b98c"/>
      <circle cx="-3" cy="-5" r="1.3" fill="#3a2a1a"/>
      <circle cx="3" cy="-5" r="1.3" fill="#3a2a1a"/>
      <path d="M -3 -1 Q 0 1 3 -1" fill="none" stroke="#3a2a1a" stroke-width="1.3"/>
      <!-- Goldmünze in der Hand -->
      <circle cx="12" cy="16" r="7" fill="${P.gold}" stroke="${P.goldDark}" stroke-width="2"/>
      <text x="12" y="20" font-size="9" fill="${P.goldDark}" text-anchor="middle" font-family="system-ui,sans-serif">$</text>
    </g>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Rohstoff-Kristalle (transparenter Grund), Farbe je Typ.
// ---------------------------------------------------------------------------
function crystal(color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <g transform="translate(32,34)">
      <polygon points="0,-18 13,-4 8,18 -8,18 -13,-4" fill="${color}" stroke="#ffffff" stroke-width="1.5" opacity="0.95"/>
      <polygon points="0,-18 0,18 -13,-4" fill="#ffffff" opacity="0.22"/>
      <polygon points="0,-18 4,-2 0,4 -4,-2" fill="#ffffff" opacity="0.5"/>
    </g>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Klassen-Icons (transparenter Grund).
// ---------------------------------------------------------------------------
function iconKaempfer(c) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <path d="M6 22 L8 20 L17 11 L19 5 L21 7 L15 15 L6 24 Z" fill="${c}"/>
    <path d="M4 10 L10 4 L14 8 L8 14 Z" fill="${c}" opacity="0.55"/>
  </svg>`;
}
function iconMagier(c) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <rect x="5" y="21" width="18" height="3" rx="1.5" transform="rotate(-45 14 22)" fill="${c}"/>
    <polygon points="20,4 22,9 27,9 23,12 24,17 20,14 16,17 17,12 13,9 18,9" fill="${c}"/>
  </svg>`;
}
function iconSchurke(c) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="9" cy="9" r="5" fill="none" stroke="${c}" stroke-width="3"/>
    <rect x="11" y="12" width="3" height="12" fill="${c}"/>
    <rect x="14" y="18" width="5" height="3" fill="${c}"/>
    <rect x="14" y="22" width="4" height="3" fill="${c}"/>
  </svg>`;
}
function iconHeiler(c) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <rect x="11" y="4" width="6" height="20" rx="2" fill="${c}"/>
    <rect x="4" y="11" width="20" height="6" rx="2" fill="${c}"/>
  </svg>`;
}

function heartIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <path d="M12 21 C 4 14 3 8 7 6 C 10 4.5 12 8 12 8 C 12 8 14 4.5 17 6 C 21 8 20 14 12 21 Z" fill="${P.hpRed}"/>
  </svg>`;
}

// Klassenfarben aus der Logik nachziehen (Single Source: classes.js) wäre ideal,
// hier reichen die Icon-Farben passend zur Gilde.
const CLASS_COLORS = {
  class_kaempfer: '#e5674d',
  class_magier: '#a855f7',
  class_schurke: '#4f9df6',
  class_heiler: '#5bbf62',
};

// ---------------------------------------------------------------------------
// Export: benannte SVG-Strings + Wand-ID -> Textur.
// ---------------------------------------------------------------------------
export const SVGS = {
  // Wände je Viertel
  wall_handel: brickWall(P.stoneLight, P.stoneMid, P.stoneDark),
  wall_pilz: brickWall(P.mossLight, P.mossMid, P.mossDark),
  wall_katakomben: brickWall(P.cryptLight, P.cryptMid, P.cryptDark),
  wall_mechanik: metalWall(P.metalLight, P.metalMid, P.metalDark),

  // Sprites
  goblin: goblin(1),
  goblin_gross: goblin(1.25),
  haendler: haendler(),
  res_erz: crystal(RESOURCES.erz.color),
  res_rune: crystal(RESOURCES.rune.color),
  res_splitter: crystal(RESOURCES.splitter.color),
  res_kraut: crystal(RESOURCES.kraut.color),

  // Klassen-Icons
  class_kaempfer: iconKaempfer(CLASS_COLORS.class_kaempfer),
  class_magier: iconMagier(CLASS_COLORS.class_magier),
  class_schurke: iconSchurke(CLASS_COLORS.class_schurke),
  class_heiler: iconHeiler(CLASS_COLORS.class_heiler),

  // HUD
  icon_heart: heartIcon(),
};

// Wand-Textur-ID (aus viertel.js) -> SVG-Schlüssel.
export const WALL_TEXTURES = {
  1: 'wall_handel',
  2: 'wall_pilz',
  3: 'wall_katakomben',
  4: 'wall_mechanik',
};

export function svgToDataUrl(svg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
