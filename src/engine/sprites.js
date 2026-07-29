// Billboard-Sprites (Gegner + Karten) in den ImageData-Puffer zeichnen.
// Nutzt den z-Buffer aus dem Raycaster für korrekte Verdeckung durch Wände.
// Render-Layer.

import { camera } from './raycaster.js';

// Zeichnet alle sichtbaren Sprites (fern -> nah) mit Alpha-Compositing.
export function drawSprites(imageData, W, H, state, textures, zBuffer) {
  const data = imageData.data;
  const { player } = state;
  const { dirX, dirY, planeX, planeY } = camera(player);

  // Sichtbare Objekte: lebende Gegner, nicht gesammelte Rohstoffe und der Händler.
  const objs = [];
  for (const e of state.enemies) {
    if (e.alive && e.hp > 0) objs.push({ x: e.x, y: e.y, sprite: e.sprite, kind: 'enemy' });
  }
  for (const r of state.resources) {
    if (!r.collected) objs.push({ x: r.x, y: r.y, sprite: r.sprite, kind: 'card', bob: true });
  }
  if (state.haendler) {
    objs.push({ x: state.haendler.x, y: state.haendler.y, sprite: state.haendler.sprite, kind: 'enemy' });
  }

  // Nach Distanz sortieren (fern zuerst).
  for (const o of objs) {
    o.dist = (o.x - player.x) ** 2 + (o.y - player.y) ** 2;
  }
  objs.sort((a, b) => b.dist - a.dist);

  const invDet = 1 / (planeX * dirY - dirX * planeY);
  const texSize = textures.size;

  for (const o of objs) {
    const spriteX = o.x - player.x;
    const spriteY = o.y - player.y;

    const transformX = invDet * (dirY * spriteX - dirX * spriteY);
    const transformY = invDet * (-planeY * spriteX + planeX * spriteY); // Tiefe
    if (transformY <= 0.05) continue; // hinter der Kamera

    const spriteScreenX = Math.floor((W / 2) * (1 + transformX / transformY));

    // Karten schweben etwas, Gegner stehen am Boden.
    const vMove = o.kind === 'card' ? -H * 0.08 : 0;
    const spriteHeight = Math.abs(Math.floor(H / transformY));
    const spriteWidth = spriteHeight;

    let drawStartY = Math.floor(-spriteHeight / 2 + H / 2 + vMove);
    let drawEndY = Math.floor(spriteHeight / 2 + H / 2 + vMove);
    const y0 = Math.max(0, drawStartY);
    const y1 = Math.min(H - 1, drawEndY);

    let drawStartX = Math.floor(-spriteWidth / 2 + spriteScreenX);
    let drawEndX = Math.floor(spriteWidth / 2 + spriteScreenX);
    const x0 = Math.max(0, drawStartX);
    const x1 = Math.min(W - 1, drawEndX);

    const tex = textures.spritePixels(o.sprite);
    if (!tex) continue;
    const tData = tex.data;
    const fog = Math.min(1, 1 / (1 + transformY * 0.1));

    for (let stripe = x0; stripe <= x1; stripe++) {
      // Verdeckung durch Wände.
      if (transformY >= zBuffer[stripe]) continue;
      const texX =
        (((stripe - (-spriteWidth / 2 + spriteScreenX)) * texSize) / spriteWidth) | 0;
      if (texX < 0 || texX >= texSize) continue;

      for (let y = y0; y <= y1; y++) {
        const texY =
          (((y - vMove - (-spriteHeight / 2 + H / 2)) * texSize) / spriteHeight) | 0;
        if (texY < 0 || texY >= texSize) continue;
        const ti = (texY * texSize + texX) * 4;
        const alpha = tData[ti + 3];
        if (alpha < 16) continue; // transparent
        const di = (y * W + stripe) * 4;
        const a = (alpha / 255) * 1;
        const inv = 1 - a;
        data[di] = tData[ti] * fog * a + data[di] * inv;
        data[di + 1] = tData[ti + 1] * fog * a + data[di + 1] * inv;
        data[di + 2] = tData[ti + 2] * fog * a + data[di + 2] * inv;
        data[di + 3] = 255;
      }
    }
  }
}
