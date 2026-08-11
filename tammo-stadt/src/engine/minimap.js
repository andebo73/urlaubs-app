// Minikarte (Draufsicht) als Overlay. Render-Layer: zeichnet mit 2D-Context.

import { palette as P } from '../assets/palette.js';
import { RESOURCES } from '../logic/classes.js';

// ctx: 2D-Context des Haupt-Canvas. (ox, oy) = obere linke Ecke, size = Kantenlänge px.
export function drawMinimap(ctx, state, ox, oy, size) {
  const { grid, player } = state;
  const cell = size / Math.max(grid.width, grid.height);

  ctx.save();
  ctx.globalAlpha = 0.85;

  // Hintergrund
  ctx.fillStyle = 'rgba(10,12,18,0.75)';
  ctx.fillRect(ox - 4, oy - 4, size + 8, size + 8);

  // Wände / freie Zellen (geschlossene Türen = ID 5 in Braun)
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const v = grid.get(x, y);
      ctx.fillStyle = v === 5 ? '#8a5a2b' : v > 0 ? P.stoneDark : '#20262f';
      ctx.fillRect(ox + x * cell, oy + y * cell, cell + 0.5, cell + 0.5);
    }
  }

  // Rohstoffe (in ihrer Farbe)
  for (const r of state.resources) {
    if (r.collected) continue;
    ctx.fillStyle = (RESOURCES[r.resId] && RESOURCES[r.resId].color) || P.gold;
    ctx.beginPath();
    ctx.arc(ox + r.x * cell, oy + r.y * cell, cell * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Gegner (rot)
  ctx.fillStyle = P.hpRed;
  for (const e of state.enemies) {
    if (!e.alive || e.hp <= 0) continue;
    ctx.beginPath();
    ctx.arc(ox + e.x * cell, oy + e.y * cell, cell * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // Truhen (braunes Quadrat)
  if (state.chests) {
    for (const c of state.chests) {
      const r = cell * 0.4;
      ctx.fillStyle = c.opened ? '#5e3f24' : '#a06a34';
      ctx.fillRect(ox + c.x * cell - r, oy + c.y * cell - r, r * 2, r * 2);
    }
  }

  // Schlüssel (kleine goldene Punkte)
  if (state.keyItems) {
    ctx.fillStyle = P.gold;
    for (const k of state.keyItems) {
      if (k.collected) continue;
      ctx.beginPath();
      ctx.arc(ox + k.x * cell, oy + k.y * cell, cell * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Bewohner (türkiser Punkt)
  if (state.bewohner) {
    ctx.fillStyle = '#3f9db0';
    ctx.beginPath();
    ctx.arc(ox + state.bewohner.x * cell, oy + state.bewohner.y * cell, cell * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Händler (goldenes Quadrat mit Rand)
  if (state.haendler) {
    const hx = ox + state.haendler.x * cell;
    const hy = oy + state.haendler.y * cell;
    const r = cell * 0.5;
    ctx.fillStyle = P.gold;
    ctx.fillRect(hx - r, hy - r, r * 2, r * 2);
    ctx.strokeStyle = P.goldDark;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(hx - r, hy - r, r * 2, r * 2);
  }

  // Spieler + Blickrichtung
  const px = ox + player.x * cell;
  const py = oy + player.y * cell;
  ctx.fillStyle = P.accent;
  ctx.beginPath();
  ctx.arc(px, py, cell * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = P.text;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.cos(player.angle) * cell * 1.2, py + Math.sin(player.angle) * cell * 1.2);
  ctx.stroke();

  ctx.restore();
}
