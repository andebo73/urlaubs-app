// Rastert die SVG-Assets einmalig in Canvas-Bitmaps und liefert Pixeldaten
// (ImageData) für den Raycaster sowie <img>-Elemente für DOM/HUD.
// Render-Layer: nutzt DOM/Canvas.

import { SVGS, WALL_TEXTURES, svgToDataUrl } from '../assets/svg.js';

const TEX_SIZE = 64;

function loadImage(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = svgToDataUrl(svg);
  });
}

export class TextureStore {
  constructor() {
    this.images = {}; // key -> HTMLImageElement
    this.pixels = {}; // key -> { data: Uint8ClampedArray, w, h }
    this.wallByeId = {}; // wandId -> key
    this.size = TEX_SIZE;
  }

  // Alle Assets laden und Wandtexturen als Pixel-Puffer aufbereiten.
  async load() {
    const keys = Object.keys(SVGS);
    const imgs = await Promise.all(keys.map((k) => loadImage(SVGS[k])));
    keys.forEach((k, i) => {
      this.images[k] = imgs[i];
    });

    // Offscreen-Canvas zum Auslesen der Pixel.
    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Für alle Sprites/Wände Pixeldaten cachen (für spaltengenaues Rendern).
    for (const k of keys) {
      ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
      ctx.drawImage(this.images[k], 0, 0, TEX_SIZE, TEX_SIZE);
      const data = ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE).data;
      this.pixels[k] = { data, w: TEX_SIZE, h: TEX_SIZE };
    }

    // Wand-ID -> Texturschlüssel
    for (const id of Object.keys(WALL_TEXTURES)) {
      this.wallByeId[id] = WALL_TEXTURES[id];
    }
  }

  wallPixels(wallId) {
    const key = this.wallByeId[wallId] || WALL_TEXTURES[1];
    return this.pixels[key];
  }

  spritePixels(spriteKey) {
    return this.pixels[spriteKey];
  }

  image(key) {
    return this.images[key];
  }
}
