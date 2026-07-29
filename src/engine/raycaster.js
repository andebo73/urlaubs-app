// DDA-Raycasting: rendert die Wände (und Decke/Boden) des Labyrinths in einen
// ImageData-Puffer und füllt den z-Buffer für die spätere Sprite-Verdeckung.
// Render-Layer.

import { palette as P } from '../assets/palette.js';

// Hex -> [r,g,b]
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const CEIL_NEAR = rgb(P.ceiling);
const CEIL_FAR = rgb(P.ceilingFar);
const FLOOR_NEAR = rgb(P.floor);
const FLOOR_FAR = rgb(P.floorFar);

// Kameraebene aus Spielerwinkel und FOV (0.66 ~ 66°).
export function camera(player, fov = 0.66) {
  const dirX = Math.cos(player.angle);
  const dirY = Math.sin(player.angle);
  // Ebene senkrecht zur Blickrichtung.
  const planeX = -dirY * fov;
  const planeY = dirX * fov;
  return { dirX, dirY, planeX, planeY };
}

// Füllt Decke/Boden als vertikalen Farbverlauf (günstig, kein Floor-Casting).
function fillBackground(data, W, H) {
  const half = H >> 1;
  for (let y = 0; y < H; y++) {
    let r, g, b;
    if (y < half) {
      const t = y / half; // 0 oben -> 1 Horizont
      r = CEIL_FAR[0] + (CEIL_NEAR[0] - CEIL_FAR[0]) * t;
      g = CEIL_FAR[1] + (CEIL_NEAR[1] - CEIL_FAR[1]) * t;
      b = CEIL_FAR[2] + (CEIL_NEAR[2] - CEIL_FAR[2]) * t;
    } else {
      const t = (y - half) / (H - half); // 0 Horizont -> 1 unten
      r = FLOOR_FAR[0] + (FLOOR_NEAR[0] - FLOOR_FAR[0]) * t;
      g = FLOOR_FAR[1] + (FLOOR_NEAR[1] - FLOOR_FAR[1]) * t;
      b = FLOOR_FAR[2] + (FLOOR_NEAR[2] - FLOOR_FAR[2]) * t;
    }
    const rowBase = y * W * 4;
    for (let x = 0; x < W; x++) {
      const i = rowBase + x * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
}

// Rendert Wände in imageData und schreibt zBuffer[x] = perpWallDist.
export function castWalls(imageData, W, H, state, textures, zBuffer) {
  const data = imageData.data;
  const { grid, player } = state;
  const { dirX, dirY, planeX, planeY } = camera(player);

  fillBackground(data, W, H);

  const texSize = textures.size;

  for (let x = 0; x < W; x++) {
    const cameraX = (2 * x) / W - 1;
    const rayDirX = dirX + planeX * cameraX;
    const rayDirY = dirY + planeY * cameraX;

    let mapX = Math.floor(player.x);
    let mapY = Math.floor(player.y);

    const deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
    const deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);

    let stepX, stepY, sideDistX, sideDistY;
    if (rayDirX < 0) {
      stepX = -1;
      sideDistX = (player.x - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1 - player.x) * deltaDistX;
    }
    if (rayDirY < 0) {
      stepY = -1;
      sideDistY = (player.y - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1 - player.y) * deltaDistY;
    }

    // DDA
    let hit = 0;
    let side = 0;
    let guard = 0;
    while (hit === 0 && guard++ < 512) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }
      hit = grid.get(mapX, mapY);
    }

    const perpWallDist =
      side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
    zBuffer[x] = perpWallDist;

    const lineHeight = Math.floor(H / Math.max(perpWallDist, 0.0001));
    let drawStart = Math.floor(-lineHeight / 2 + H / 2);
    let drawEnd = Math.floor(lineHeight / 2 + H / 2);
    const clampStart = Math.max(0, drawStart);
    const clampEnd = Math.min(H - 1, drawEnd);

    // Textur-X aus exakter Trefferposition.
    let wallX =
      side === 0
        ? player.y + perpWallDist * rayDirY
        : player.x + perpWallDist * rayDirX;
    wallX -= Math.floor(wallX);
    let texX = Math.floor(wallX * texSize);
    if ((side === 0 && rayDirX > 0) || (side === 1 && rayDirY < 0)) {
      texX = texSize - texX - 1;
    }

    const tex = textures.wallPixels(hit);
    const tData = tex.data;
    // Abdunkeln fürs Tiefengefühl + eine Wandseite dunkler.
    const shade = side === 1 ? 0.7 : 1.0;
    const fog = Math.min(1, 1 / (1 + perpWallDist * 0.12));

    const step = texSize / lineHeight;
    let texPos = (clampStart - H / 2 + lineHeight / 2) * step;

    for (let y = clampStart; y <= clampEnd; y++) {
      const texY = Math.min(texSize - 1, Math.max(0, texPos | 0));
      texPos += step;
      const ti = (texY * texSize + texX) * 4;
      const m = shade * fog;
      const di = (y * W + x) * 4;
      data[di] = tData[ti] * m;
      data[di + 1] = tData[ti + 1] * m;
      data[di + 2] = tData[ti + 2] * m;
      data[di + 3] = 255;
    }
  }
}
