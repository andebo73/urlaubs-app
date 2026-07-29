// Minikarte (Draufsicht) als Overlay. Render-Layer: zeichnet mit 2D-Context.

import { palette as P } from '../assets/palette.js';

// ctx: 2D-Context des Haupt-Canvas. (ox, oy) = obere linke Ecke, size = Kantenlänge px.
export function drawMinimap(ctx, state, ox, oy, size) {
  const { grid, player } = state;
  const cell = size / Math.max(grid.width, grid.height);

  ctx.save();
  ctx.globalAlpha = 0.85;

  // Hintergrund
  ctx.fillStyle = 'rgba(10,12,18,0.75)';
  ctx.fillRect(ox - 4, oy - 4, size + 8, size + 8);

  // Wände / freie Zellen
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const v = grid.get(x, y);
      ctx.fillStyle = v > 0 ? P.stoneDark : '#20262f';
      ctx.fillRect(ox + x * cell, oy + y * cell, cell + 0.5, cell + 0.5);
    }
  }

  // Karten (gold)
  ctx.fillStyle = P.gold;
  for (const c of state.cards) {
    if (c.collected) continue;
    ctx.beginPath();
    ctx.arc(ox + c.x * cell, oy + c.y * cell, cell * 0.35, 0, Math.PI * 2);
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
