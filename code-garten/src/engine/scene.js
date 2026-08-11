// Rendering für Code-Garten: zeichnet die Rasen-Map, den Avatar und die
// eingelösten Items als schwebende Marker auf der Wiese. Reines Canvas-Zeichnen
// mit eigenen Primitiven (rect/arc/path); Item-Symbole sind System-Emoji.
//
// Alle Koordinaten in CSS-Pixeln – die DPR-Skalierung erledigt main.js über die
// Canvas-Transform, damit hier ohne Umrechnen gezeichnet werden kann.

import { palette as P } from '../assets/palette.js';

// Deterministische Deko-Positionen (kleiner eigener LCG statt Math.random,
// damit die Wiese bei jedem Laden gleich aussieht und Tests stabil bleiben).
const DECO = (() => {
  let s = 20260811;
  const rnd = () => {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const arr = [];
  for (let i = 0; i < 30; i++) {
    const r = rnd();
    arr.push({
      rx: rnd(),
      ry: rnd(),
      type: r < 0.45 ? 'flower' : r < 0.72 ? 'bush' : 'tuft',
      variant: Math.floor(rnd() * P.flowers.length),
      scale: 0.7 + rnd() * 0.7,
    });
  }
  return arr;
})();

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Hauptzeichnung eines Frames.
export function drawScene(ctx, W, H, state, t) {
  drawLawn(ctx, W, H);

  const cx = W / 2;
  const cy = H * 0.54;
  const avatarS = Math.max(90, Math.min(200, Math.min(W, H) * 0.26));

  const items = state.list();
  drawItemsRing(ctx, cx, cy, W, H, items, t);
  drawAvatar(ctx, cx, cy, avatarS, state, t);
}

function drawLawn(ctx, W, H) {
  // Grundfläche + gemähte Streifen.
  ctx.fillStyle = P.grass;
  ctx.fillRect(0, 0, W, H);
  const stripe = Math.max(28, H / 14);
  for (let y = 0, i = 0; y < H; y += stripe, i++) {
    ctx.fillStyle = i % 2 === 0 ? P.grassStripe : P.grass;
    ctx.fillRect(0, y, W, stripe);
  }

  // Deko über die ganze Fläche verteilen.
  for (const d of DECO) {
    const x = d.rx * W;
    const y = d.ry * H;
    if (d.type === 'flower') drawFlower(ctx, x, y, 6 * d.scale, P.flowers[d.variant]);
    else if (d.type === 'bush') drawBush(ctx, x, y, 16 * d.scale);
    else drawTuft(ctx, x, y, 10 * d.scale);
  }
}

function drawTuft(ctx, x, y, s) {
  ctx.strokeStyle = P.grassDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = -2; i <= 2; i++) {
    ctx.moveTo(x + i * 3, y);
    ctx.lineTo(x + i * 3 + i, y - s);
  }
  ctx.stroke();
}

function drawBush(ctx, x, y, s) {
  ctx.fillStyle = P.bushDark;
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.2, s, s * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.bush;
  ctx.beginPath();
  ctx.ellipse(x - s * 0.3, y, s * 0.6, s * 0.5, 0, 0, Math.PI * 2);
  ctx.ellipse(x + s * 0.4, y - s * 0.1, s * 0.55, s * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlower(ctx, x, y, s, color) {
  ctx.strokeStyle = P.grassDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + s * 1.6);
  ctx.stroke();
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.6, s * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = P.gold;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.55, 0, Math.PI * 2);
  ctx.fill();
}

// Eingelöste Items als schwebende Marker in einem Ring um den Avatar.
function drawItemsRing(ctx, cx, cy, W, H, items, t) {
  if (!items.length) return;
  const rx = Math.min(W * 0.36, 300);
  const ry = rx * 0.5;
  const pw = Math.max(46, Math.min(78, Math.min(W, H) * 0.13));
  const n = items.length;

  // Von hinten (oben) nach vorne (unten) zeichnen, damit die Überlappung stimmt.
  const order = items
    .map((it, i) => ({ it, i, ang: -Math.PI / 2 + (i / n) * Math.PI * 2 }))
    .sort((a, b) => Math.sin(a.ang) - Math.sin(b.ang));

  for (const { it, i, ang } of order) {
    const x = cx + Math.cos(ang) * rx;
    const yBase = cy + Math.sin(ang) * ry;
    const bob = Math.sin(t * 2 + i) * 5;
    drawItemMarker(ctx, x, yBase, bob, pw, it);
  }
}

function drawItemMarker(ctx, x, yBase, bob, pw, it) {
  // Bodenschatten (bleibt liegen).
  ctx.fillStyle = P.shadow;
  ctx.beginPath();
  ctx.ellipse(x, yBase + pw * 0.5, pw * 0.42, pw * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  const y = yBase + bob;

  // Glühen bei legendären Items.
  if (it.rarity === 'legendär') {
    ctx.save();
    ctx.shadowColor = it.color;
    ctx.shadowBlur = 18;
  }

  // Karte/Podest in Seltenheitsfarbe.
  const cardX = x - pw / 2;
  const cardY = y - pw / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  roundRect(ctx, cardX, cardY, pw, pw, pw * 0.22);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = it.color;
  roundRect(ctx, cardX + 1.5, cardY + 1.5, pw - 3, pw - 3, pw * 0.2);
  ctx.stroke();
  if (it.rarity === 'legendär') ctx.restore();

  // Emoji-Symbol.
  ctx.font = `${Math.round(pw * 0.52)}px system-ui, "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(it.emoji, x, y + 1);

  // Anzahl-Badge, falls mehr als eins.
  if (it.count > 1) {
    const bx = cardX + pw - 6;
    const by = cardY + 6;
    ctx.fillStyle = it.color;
    ctx.beginPath();
    ctx.arc(bx, by, pw * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(pw * 0.2)}px system-ui, sans-serif`;
    ctx.fillText('×' + it.count, bx, by + 1);
  }
}

// Blockiger Avatar aus einfachen Rechtecken. Zubehör (Krone/Hut/Haustier)
// erscheint, sobald man das passende Item besitzt – als Belohnungs-Feedback.
function drawAvatar(ctx, cx, cy, s, state, t) {
  const bob = Math.sin(t * 1.6) * s * 0.015;
  const top = cy - s * 0.5 + bob;

  const headS = s * 0.3;
  const bodyW = s * 0.36;
  const bodyH = s * 0.34;
  const armW = s * 0.1;
  const armH = s * 0.3;
  const legW = s * 0.14;
  const legH = s * 0.26;

  // Bodenschatten (ohne bob, bleibt am Boden).
  ctx.fillStyle = P.shadow;
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.5, s * 0.32, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyY = top + headS * 0.98;
  const legsY = bodyY + bodyH;

  // Beine
  ctx.fillStyle = P.pantsDark;
  ctx.fillRect(cx - legW - 3, legsY, legW, legH);
  ctx.fillRect(cx + 3, legsY, legW, legH);
  ctx.fillStyle = P.pants;
  ctx.fillRect(cx - legW - 3, legsY, legW * 0.5, legH);
  ctx.fillRect(cx + 3, legsY, legW * 0.5, legH);

  // Arme
  ctx.fillStyle = P.shirtDark;
  ctx.fillRect(cx - bodyW / 2 - armW, bodyY, armW, armH);
  ctx.fillRect(cx + bodyW / 2, bodyY, armW, armH);
  // Hände
  ctx.fillStyle = P.skin;
  ctx.fillRect(cx - bodyW / 2 - armW, bodyY + armH - armW, armW, armW);
  ctx.fillRect(cx + bodyW / 2, bodyY + armH - armW, armW, armW);

  // Körper (Shirt)
  ctx.fillStyle = P.shirt;
  roundRect(ctx, cx - bodyW / 2, bodyY, bodyW, bodyH, s * 0.05);
  ctx.fill();
  ctx.fillStyle = P.shirtDark;
  ctx.fillRect(cx - bodyW / 2, bodyY + bodyH * 0.62, bodyW, bodyH * 0.12);

  // Kopf
  ctx.fillStyle = P.skin;
  roundRect(ctx, cx - headS / 2, top, headS, headS, headS * 0.24);
  ctx.fill();
  ctx.fillStyle = P.skinDark;
  ctx.fillRect(cx - headS / 2, top + headS * 0.86, headS, headS * 0.14);

  // Gesicht
  ctx.fillStyle = P.eye;
  const eyeY = top + headS * 0.44;
  ctx.fillRect(cx - headS * 0.22, eyeY, headS * 0.12, headS * 0.14);
  ctx.fillRect(cx + headS * 0.1, eyeY, headS * 0.12, headS * 0.14);
  ctx.lineWidth = Math.max(2, headS * 0.05);
  ctx.strokeStyle = P.eye;
  ctx.beginPath();
  ctx.arc(cx, top + headS * 0.6, headS * 0.2, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // Zubehör auf dem Kopf: Krone schlägt Hut.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (state.has('krone')) {
    ctx.font = `${Math.round(headS * 0.9)}px system-ui, "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText('👑', cx, top - headS * 0.28);
  } else if (state.has('hut')) {
    ctx.font = `${Math.round(headS * 0.9)}px system-ui, "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText('🎩', cx, top - headS * 0.22);
  }

  // Haustier neben den Füßen.
  const pet = state.has('haustier_drache') ? '🐉' : state.has('haustier_hund') ? '🐶' : null;
  if (pet) {
    const px = cx + bodyW * 1.3;
    const py = cy + s * 0.4 + Math.sin(t * 2.4) * 3;
    ctx.font = `${Math.round(s * 0.24)}px system-ui, "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText(pet, px, py);
  }
}
