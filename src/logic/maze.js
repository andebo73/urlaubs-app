// Labyrinth-Generierung per randomisierter Tiefensuche (DFS) aus einem Seed.
// Erzeugt ein zusammenhängendes, "perfektes" Labyrinth (genau ein Weg zwischen
// je zwei Zellen), danach werden ein paar Wände zufällig entfernt, damit es
// Schleifen/Abkürzungen gibt und sich weniger wie eine Sackgassen-Wüste anfühlt.
// Reine Logik: nutzt Rng, kein Math.random(), kein DOM.

import { Grid } from './grid.js';

// Wandtextur-IDs (>0). Werden beim Carven zufällig gesetzt, damit Wände variieren.
const WALL_IDS = [1, 2];

// cols/rows = Anzahl der begehbaren Zellen pro Achse. Das resultierende Gitter
// ist (2*cols+1) x (2*rows+1), weil zwischen Zellen Wände liegen.
export function generateMaze(rng, cols = 10, rows = 10, loopChance = 0.08) {
  const width = cols * 2 + 1;
  const height = rows * 2 + 1;
  const grid = new Grid(width, height, 1); // erst alles Wand

  // Zellkoordinate (cx, cy) -> Gitterkoordinate der begehbaren Mitte
  const gx = (cx) => cx * 2 + 1;
  const gy = (cy) => cy * 2 + 1;

  const visited = new Set();
  const key = (cx, cy) => cy * cols + cx;

  const carve = (cx, cy) => {
    grid.set(gx(cx), gy(cy), 0);
  };

  // Iterative DFS mit explizitem Stack (kein Rekursionslimit).
  const startX = rng.int(0, cols - 1);
  const startY = rng.int(0, rows - 1);
  const stack = [[startX, startY]];
  visited.add(key(startX, startY));
  carve(startX, startY);

  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1];

    // Unbesuchte Nachbarn sammeln
    const neighbours = [];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (visited.has(key(nx, ny))) continue;
      neighbours.push([nx, ny, dx, dy]);
    }

    if (neighbours.length === 0) {
      stack.pop();
      continue;
    }

    // Zufälligen Nachbarn wählen, Wand dazwischen niederreißen
    const [nx, ny, dx, dy] = neighbours[rng.int(0, neighbours.length - 1)];
    grid.set(gx(cx) + dx, gy(cy) + dy, 0); // Wand zwischen den Zellen
    carve(nx, ny);
    visited.add(key(nx, ny));
    stack.push([nx, ny]);
  }

  // Ein paar zusätzliche Durchbrüche für Schleifen/Abkürzungen.
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (grid.get(x, y) === 0) continue;
      // Nur "dünne" Wände zwischen zwei freien Zellen aufbrechen.
      const horizontal = grid.get(x - 1, y) === 0 && grid.get(x + 1, y) === 0;
      const vertical = grid.get(x, y - 1) === 0 && grid.get(x, y + 1) === 0;
      if ((horizontal || vertical) && rng.chance(loopChance)) {
        grid.set(x, y, 0);
      }
    }
  }

  // Verbleibenden Wänden eine (deterministische) Textur-ID geben.
  for (let i = 0; i < grid.cells.length; i++) {
    if (grid.cells[i] > 0) {
      grid.cells[i] = WALL_IDS[rng.int(0, WALL_IDS.length - 1)];
    }
  }

  return grid;
}

// Prüft, ob alle freien Zellen zusammenhängen (für Tests). Flood-Fill.
export function isFullyConnected(grid) {
  const free = grid.freeCells();
  if (free.length === 0) return true;
  const seen = new Set();
  const key = (x, y) => y * grid.width + x;
  const stack = [free[0]];
  seen.add(key(free[0].x, free[0].y));
  while (stack.length) {
    const { x, y } = stack.pop();
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (grid.get(nx, ny) === 0 && !seen.has(key(nx, ny))) {
        seen.add(key(nx, ny));
        stack.push({ x: nx, y: ny });
      }
    }
  }
  return seen.size === free.length;
}
