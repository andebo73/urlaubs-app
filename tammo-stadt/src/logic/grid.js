// Gitter-Repräsentation der Spielwelt. 0 = frei, >0 = Wand-Textur-ID.
// Reine Logik: keine DOM-Abhängigkeit.

export class Grid {
  constructor(width, height, fill = 1) {
    this.width = width;
    this.height = height;
    this.cells = new Uint8Array(width * height).fill(fill);
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  // Zellwert an ganzzahliger Position. Außerhalb gilt als Wand.
  get(x, y) {
    if (!this.inBounds(x, y)) return 1;
    return this.cells[y * this.width + x];
  }

  set(x, y, value) {
    if (!this.inBounds(x, y)) return;
    this.cells[y * this.width + x] = value;
  }

  // Ist die Zelle an (Weltkoordinate) begehbar? Weltkoordinaten werden abgerundet.
  isWallAt(worldX, worldY) {
    return this.get(Math.floor(worldX), Math.floor(worldY)) > 0;
  }

  isFree(x, y) {
    return this.get(x, y) === 0;
  }

  // Liste aller freien Zellen als {x, y}. Nützlich für Platzierung.
  freeCells() {
    const out = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.cells[y * this.width + x] === 0) out.push({ x, y });
      }
    }
    return out;
  }

  // Anzahl freier orthogonaler Nachbarn einer Zelle.
  freeNeighbourCount(x, y) {
    let n = 0;
    if (this.get(x + 1, y) === 0) n++;
    if (this.get(x - 1, y) === 0) n++;
    if (this.get(x, y + 1) === 0) n++;
    if (this.get(x, y - 1) === 0) n++;
    return n;
  }

  clone() {
    const g = new Grid(this.width, this.height, 0);
    g.cells = new Uint8Array(this.cells);
    return g;
  }
}
