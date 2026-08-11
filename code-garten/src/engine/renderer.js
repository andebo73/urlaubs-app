// 3D-Rendering für Code-Garten. Einfache Perspektiv-Projektion auf ein
// 2D-Canvas: Rasen-Boden in Streifen, blockiger Avatar (echte 3D-Boxen mit
// Lauf-Animation), Deko (Bäume/Büsche/Blumen) und die eingelösten Items als
// Billboards. Kein WebGL, keine externen Assets.

import { palette as P } from '../assets/palette.js';
import { FIELD, TREES, BUSHES, FLOWERS } from '../logic/world.js';

const FOV = 1.02;      // Blickwinkel (Bogenmaß)
const NEAR = 0.06;     // Nah-Ebene für das Clipping
const LIGHT = normalize3(0.4, 1, 0.35); // Richtung des Sonnenlichts

// Feste Stellplätze für Items, über die Wiese verteilt (deterministisch).
export const ITEM_SLOTS = (() => {
  const slots = [];
  const cols = [-16, -9.6, -3.2, 3.2, 9.6, 16];
  const rows = [-8, -1, 6, 13, 20];
  for (const z of rows) for (const x of cols) slots.push({ x, z });
  return slots;
})();

// --- Projektion ------------------------------------------------------------
function makeProjector(cam, W, H) {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const focal = (H * 0.5) / Math.tan(FOV * 0.5);
  return {
    W, H, focal,
    // Weltpunkt -> Kamerakoordinaten (noch ohne Perspektiv-Division).
    toView(x, y, z) {
      const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
      const vx = dx * cy - dz * sy;      // rechts
      const vz0 = dx * sy + dz * cy;     // vorwärts
      const vy0 = dy;                    // oben
      const vz = vz0 * cp - vy0 * sp;    // Pitch (Kamera nach unten kippen)
      const vy = vy0 * cp + vz0 * sp;
      return { x: vx, y: vy, z: vz };
    },
    // Kamerakoordinaten -> Bildschirm.
    toScreen(v) {
      return { x: this.W / 2 + (v.x / v.z) * this.focal, y: this.H / 2 - (v.y / v.z) * this.focal };
    },
  };
}

// Polygon (Liste von Kamerakoordinaten) an der Nah-Ebene z>=NEAR clippen.
function clipNear(verts) {
  const out = [];
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const aIn = a.z >= NEAR;
    const bIn = b.z >= NEAR;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = (NEAR - a.z) / (b.z - a.z);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR });
    }
  }
  return out;
}

function fillViewPoly(ctx, pj, verts, style) {
  const clipped = clipNear(verts);
  if (clipped.length < 3) return;
  ctx.fillStyle = style;
  ctx.beginPath();
  for (let i = 0; i < clipped.length; i++) {
    const s = pj.toScreen(clipped[i]);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  }
  ctx.closePath();
  ctx.fill();
}

// --- Hauptzeichnung --------------------------------------------------------
export function drawWorld(ctx, W, H, world, items, t) {
  const cam = world.camera();
  const pj = makeProjector(cam, W, H);

  drawBackground(ctx, W, H, pj, cam);
  drawGround(ctx, pj, cam);

  const draws = [];
  addDecorations(draws, pj);
  addItems(draws, pj, items, t);
  addAvatar(draws, pj, world, t);

  draws.sort((a, b) => b.depth - a.depth); // hinten zuerst
  for (const d of draws) d.fn(ctx);
}

function drawBackground(ctx, W, H, pj, cam) {
  // Horizont grob über einen weit entfernten Bodenpunkt bestimmen.
  const far = pj.toView(cam.x + Math.sin(cam.yaw) * 400, 0, cam.z + Math.cos(cam.yaw) * 400);
  let horizon = H * 0.42;
  if (far.z > NEAR) horizon = pj.toScreen(far).y;
  horizon = Math.max(0, Math.min(H, horizon));

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#7ec8ff');
  sky.addColorStop(1, '#cfeeff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);

  ctx.fillStyle = P.grassEdge;
  ctx.fillRect(0, horizon - 1, W, H - horizon + 1);
}

// Rasen als quer verlaufende, gemähte Streifen (perspektivisch).
function drawGround(ctx, pj, cam) {
  const step = 2;
  const bands = [];
  for (let z = -FIELD; z < FIELD; z += step) bands.push(z);
  // Von hinten nach vorne, damit nähere Streifen sauber überdecken.
  bands.sort((a, b) => distToCam(cam, b) - distToCam(cam, a));
  for (const z0 of bands) {
    const z1 = z0 + step;
    const idx = Math.round((z0 + FIELD) / step);
    const style = idx % 2 === 0 ? P.grass : P.grassStripe;
    const verts = [
      pj.toView(-FIELD, 0, z0),
      pj.toView(FIELD, 0, z0),
      pj.toView(FIELD, 0, z1),
      pj.toView(-FIELD, 0, z1),
    ];
    fillViewPoly(ctx, pj, verts, style);
  }
  drawFence(ctx, pj);
}

function distToCam(cam, z) {
  return Math.abs(z - cam.z);
}

// Niedrige Umzäunung als Feldbegrenzung (vier flache Wände + Eckpfosten).
function drawFence(ctx, pj) {
  const h = 1.2;
  const walls = [
    { a: [-FIELD, FIELD], b: [FIELD, FIELD] },
    { a: [FIELD, FIELD], b: [FIELD, -FIELD] },
    { a: [FIELD, -FIELD], b: [-FIELD, -FIELD] },
    { a: [-FIELD, -FIELD], b: [-FIELD, FIELD] },
  ];
  const faces = [];
  for (const w of walls) {
    const [x1, z1] = w.a;
    const [x2, z2] = w.b;
    faces.push(quad(pj, [x1, 0, z1], [x2, 0, z2], [x2, h, z2], [x1, h, z1], '#b98f52'));
    faces.push(quad(pj, [x1, h - 0.25, z1], [x2, h - 0.25, z2], [x2, h, z2], [x1, h, z1], '#caa46a'));
  }
  // Eckpfosten als kleine Boxen.
  for (const [x, z] of [[-FIELD, FIELD], [FIELD, FIELD], [FIELD, -FIELD], [-FIELD, -FIELD]]) {
    boxFaces(pj, x, 0.8, z, 0.6, 1.6, 0.6, '#8a6a3c').forEach((f) => faces.push(f));
  }
  faces.sort((a, b) => b.depth - a.depth);
  for (const f of faces) f.fn(ctx);
}

function quad(pj, p1, p2, p3, p4, style) {
  const v = [pj.toView(...p1), pj.toView(...p2), pj.toView(...p3), pj.toView(...p4)];
  const depth = (v[0].z + v[1].z + v[2].z + v[3].z) / 4;
  return { depth, fn: (ctx) => fillViewPoly(ctx, pj, v, style) };
}

// --- 3D-Box (für Avatar) ---------------------------------------------------
// center: [x,y,z], size: [w,h,d]. Optionaler Swing um eine horizontale Achse
// (Blickrichtung/Oben-Ebene) für Lauf-Animation, mit Drehpunkt oben an der Box.
function boxFaces(pj, cx, cy, cz, w, h, d, color, opts = {}) {
  const hx = w / 2, hy = h / 2, hz = d / 2;
  let corners = [
    [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
    [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz],
  ];

  // Optionaler Swing (Beine/Arme) um die Seitenachse des Avatars.
  if (opts.swing) {
    const f = opts.f, r = opts.r; // Vorwärts / Rechts (Einheitsvektoren in xz)
    const pivotY = opts.pivotY != null ? opts.pivotY - cy : hy; // lokal
    const c = Math.cos(opts.swing), s = Math.sin(opts.swing);
    corners = corners.map(([lx, ly, lz]) => {
      // lokal -> Welt-Deltas (x,z über r und f)
      const wx = lx; // Box ist an der Avatar-Achse ausgerichtet -> lokal x == rechts
      const dy = ly - pivotY;
      // Vorwärtsanteil der Box-Tiefe (lokal z == vorwärts)
      const fComp = lz;
      const fRot = fComp * c - dy * s;
      const yRot = fComp * s + dy * c + pivotY;
      return [wx, yRot, fRot];
    });
  }

  // Lokale Achsen -> Welt: x=rechts(r), z=vorwärts(f), y=oben.
  const f = opts.f || { x: 0, z: 1 };
  const r = opts.r || { x: 1, z: 0 };
  const world = corners.map(([lx, ly, lz]) => [
    cx + r.x * lx + f.x * lz,
    cy + ly,
    cz + r.z * lx + f.z * lz,
  ]);
  const view = world.map((p) => pj.toView(p[0], p[1], p[2]));

  const FACES = [
    { idx: [4, 5, 6, 7], n: [0, 0, 1] },   // vorne (+z lokal = vorwärts)
    { idx: [1, 0, 3, 2], n: [0, 0, -1] },  // hinten
    { idx: [5, 1, 2, 6], n: [1, 0, 0] },   // rechts
    { idx: [0, 4, 7, 3], n: [-1, 0, 0] },  // links
    { idx: [3, 2, 6, 7], n: [0, 1, 0] },   // oben
    { idx: [0, 1, 5, 4], n: [0, -1, 0] },  // unten
  ];
  const out = [];
  for (const face of FACES) {
    const verts = face.idx.map((i) => view[i]);
    const depth = verts.reduce((s, v) => s + v.z, 0) / 4;
    // Weltnormale grob (ohne Swing) für die Schattierung.
    const nx = r.x * face.n[0] + f.x * face.n[2];
    const nz = r.z * face.n[0] + f.z * face.n[2];
    const shade = faceShade(nx, face.n[1], nz);
    out.push({ depth, fn: (ctx) => fillViewPoly(ctx, pj, verts, tint(color, shade)) });
  }
  return out;
}

function faceShade(nx, ny, nz) {
  const d = nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z;
  return 0.68 + Math.max(0, d) * 0.42;
}

function addAvatar(draws, pj, world, t) {
  const f = world.forward();
  const r = world.right();
  const bx = world.x, bz = world.z;
  const swing = world.moving ? Math.sin(world.walkPhase) * 0.6 : Math.sin(t * 2) * 0.04;

  const push = (faces) => faces.forEach((fc) => draws.push(fc));

  // Beine (schwingen gegenläufig, Drehpunkt an der Hüfte y=2).
  push(boxFaces(pj, off(bx, r, -0.32), 1, off(bz, r, -0.32, true), 0.55, 2, 0.6, P.pants, { f, r, swing, pivotY: 2 }));
  push(boxFaces(pj, off(bx, r, 0.32), 1, off(bz, r, 0.32, true), 0.55, 2, 0.6, P.pants, { f, r, swing: -swing, pivotY: 2 }));

  // Torso.
  push(boxFaces(pj, bx, 3.05, bz, 1.5, 2.1, 0.85, P.shirt, { f, r }));

  // Arme (Drehpunkt an der Schulter y=4).
  push(boxFaces(pj, off(bx, r, -1.02), 3.05, off(bz, r, -1.02, true), 0.5, 2, 0.55, P.skin, { f, r, swing: -swing, pivotY: 4 }));
  push(boxFaces(pj, off(bx, r, 1.02), 3.05, off(bz, r, 1.02, true), 0.5, 2, 0.55, P.skin, { f, r, swing, pivotY: 4 }));

  // Kopf.
  const headY = 4.7;
  push(boxFaces(pj, bx, headY, bz, 1.15, 1.1, 1.1, P.skin, { f, r }));

  // Gesicht (zwei Augen + Mund) auf die Vorderseite als kleine Billboards.
  const facePt = pj.toView(bx + f.x * 0.58, headY + 0.05, bz + f.z * 0.58);
  if (facePt.z > NEAR) {
    const s = pj.toScreen(facePt);
    const sc = pj.focal / facePt.z;
    draws.push({
      depth: facePt.z - 0.01,
      fn: (ctx) => {
        ctx.fillStyle = P.eye;
        const e = 0.12 * sc;
        ctx.fillRect(s.x - 0.22 * sc, s.y - 0.1 * sc, e, e * 1.3);
        ctx.fillRect(s.x + 0.1 * sc, s.y - 0.1 * sc, e, e * 1.3);
        ctx.strokeStyle = P.eye;
        ctx.lineWidth = Math.max(1, 0.05 * sc);
        ctx.beginPath();
        ctx.arc(s.x, s.y + 0.05 * sc, 0.2 * sc, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      },
    });
  }

  // Zubehör: Krone/Hut auf dem Kopf, Haustier daneben (Emoji-Billboards).
  const accessory = world.hasKrone ? '👑' : world.hasHut ? '🎩' : null;
  if (accessory) emojiBillboard(draws, pj, bx, headY + 0.95, bz, accessory, 1.5);
  if (world.pet) {
    const px = bx - r.x * 1.7 + f.x * 0.3;
    const pz = bz - r.z * 1.7 + f.z * 0.3;
    emojiBillboard(draws, pj, px, 0.8 + Math.sin(t * 2.5) * 0.1, pz, world.pet, 1.7);
  }
}

// Verschiebt eine Achse (x oder z) entlang des Rechts-Vektors des Avatars.
function off(base, r, amount, isZ) {
  return base + (isZ ? r.z : r.x) * amount;
}

// --- Deko ------------------------------------------------------------------
function addDecorations(draws, pj) {
  for (const tr of TREES) addTree(draws, pj, tr.x, tr.z);
  for (const b of BUSHES) addBush(draws, pj, b.x, b.z);
  for (const fl of FLOWERS) addFlower(draws, pj, fl.x, fl.z, fl.variant);
}

function addTree(draws, pj, x, z) {
  const trunk = boxFaces(pj, x, 1.4, z, 0.7, 2.8, 0.7, '#7a4f2b');
  trunk.forEach((fc) => draws.push(fc));
  // Blätterkrone als drei versetzte grüne Ellipsen (Billboard).
  const top = pj.toView(x, 4.4, z);
  if (top.z > NEAR) {
    const s = pj.toScreen(top);
    const sc = pj.focal / top.z;
    draws.push({
      depth: top.z,
      fn: (ctx) => {
        ctx.fillStyle = P.bushDark;
        blob(ctx, s.x, s.y + 0.2 * sc, 1.9 * sc, 1.5 * sc);
        ctx.fillStyle = P.bush;
        blob(ctx, s.x - 0.5 * sc, s.y - 0.3 * sc, 1.4 * sc, 1.2 * sc);
        blob(ctx, s.x + 0.6 * sc, s.y - 0.1 * sc, 1.3 * sc, 1.1 * sc);
      },
    });
  }
}

function addBush(draws, pj, x, z) {
  const p = pj.toView(x, 0.5, z);
  if (p.z <= NEAR) return;
  const s = pj.toScreen(p);
  const sc = pj.focal / p.z;
  draws.push({
    depth: p.z,
    fn: (ctx) => {
      ctx.fillStyle = P.shadow;
      blob(ctx, s.x, s.y + 0.5 * sc, 1.2 * sc, 0.4 * sc);
      ctx.fillStyle = P.bushDark;
      blob(ctx, s.x, s.y, 1.1 * sc, 0.9 * sc);
      ctx.fillStyle = P.bush;
      blob(ctx, s.x - 0.35 * sc, s.y - 0.2 * sc, 0.7 * sc, 0.6 * sc);
    },
  });
}

function addFlower(draws, pj, x, z, variant) {
  const p = pj.toView(x, 0.35, z);
  if (p.z <= NEAR) return;
  const s = pj.toScreen(p);
  const sc = pj.focal / p.z;
  const color = P.flowers[variant % P.flowers.length];
  draws.push({
    depth: p.z,
    fn: (ctx) => {
      ctx.strokeStyle = P.grassEdge;
      ctx.lineWidth = Math.max(1, 0.06 * sc);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x, s.y + 0.5 * sc);
      ctx.stroke();
      ctx.fillStyle = color;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        blob(ctx, s.x + Math.cos(a) * 0.22 * sc, s.y + Math.sin(a) * 0.22 * sc, 0.14 * sc, 0.14 * sc);
      }
      ctx.fillStyle = P.gold;
      blob(ctx, s.x, s.y, 0.13 * sc, 0.13 * sc);
    },
  });
}

// --- Items als Billboards --------------------------------------------------
function addItems(draws, pj, items, t) {
  items.forEach((it, i) => {
    const slot = ITEM_SLOTS[i % ITEM_SLOTS.length];
    const bob = Math.sin(t * 2 + i) * 0.15;
    emojiCard(draws, pj, slot.x, 1.5 + bob, slot.z, it, t);
  });
}

function emojiCard(draws, pj, x, y, z, it, t) {
  const p = pj.toView(x, y, z);
  const ground = pj.toView(x, 0, z);
  if (p.z <= NEAR) return;
  const s = pj.toScreen(p);
  const sc = pj.focal / p.z;
  const size = 1.05 * sc;
  draws.push({
    depth: p.z,
    fn: (ctx) => {
      // Bodenschatten
      if (ground.z > NEAR) {
        const gs = pj.toScreen(ground);
        ctx.fillStyle = P.shadow;
        blob(ctx, gs.x, gs.y, size * 0.4, size * 0.16);
      }
      // Karte in Seltenheitsfarbe
      const x0 = s.x - size / 2, y0 = s.y - size / 2;
      if (it.rarity === 'legendär') {
        ctx.save();
        ctx.shadowColor = it.color;
        ctx.shadowBlur = size * 0.4;
      }
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      roundRect(ctx, x0, y0, size, size, size * 0.22);
      ctx.fill();
      ctx.lineWidth = Math.max(2, size * 0.06);
      ctx.strokeStyle = it.color;
      roundRect(ctx, x0 + 1, y0 + 1, size - 2, size - 2, size * 0.2);
      ctx.stroke();
      if (it.rarity === 'legendär') ctx.restore();
      // Emoji
      ctx.font = `${Math.round(size * 0.56)}px system-ui, "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.emoji, s.x, s.y + size * 0.02);
      if (it.count > 1) {
        ctx.fillStyle = it.color;
        blob(ctx, x0 + size, y0, size * 0.17, size * 0.17);
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(size * 0.2)}px system-ui, sans-serif`;
        ctx.fillText('×' + it.count, x0 + size, y0 + 1);
      }
    },
  });
}

function emojiBillboard(draws, pj, x, y, z, emoji, worldSize) {
  const p = pj.toView(x, y, z);
  if (p.z <= NEAR) return;
  const s = pj.toScreen(p);
  const px = worldSize * (pj.focal / p.z);
  draws.push({
    depth: p.z - 0.02,
    fn: (ctx) => {
      ctx.font = `${Math.round(px)}px system-ui, "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, s.x, s.y);
    },
  });
}

// --- kleine Zeichen-Helfer -------------------------------------------------
function blob(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

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

function normalize3(x, y, z) {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
}

function tint(hex, factor) {
  const c = hexToRgb(hex);
  const r = Math.min(255, Math.round(c.r * factor));
  const g = Math.min(255, Math.round(c.g * factor));
  const b = Math.min(255, Math.round(c.b * factor));
  return `rgb(${r},${g},${b})`;
}

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
