// Viertel (Stadtteile) der Tammo Stadt. Das Labyrinth wird in vier Zonen
// geteilt (Quadranten), jede mit eigener Wandtextur und Charakter.
// Reine Logik: kein DOM.

// Wand-Textur-ID für (geschlossene) Türen.
export const DOOR_WALL = 5;

export const VIERTEL = {
  handel: { id: 'handel', name: 'Handelsviertel', wall: 1, danger: false },
  pilz: { id: 'pilz', name: 'Pilzviertel', wall: 2, danger: false },
  katakomben: { id: 'katakomben', name: 'Katakomben', wall: 3, danger: true },
  mechanik: { id: 'mechanik', name: 'Mechanikerviertel', wall: 4, danger: true },
};

// Quadranten-Zuordnung: oben-links = Handelsviertel (dort startet man),
// oben-rechts = Pilzviertel, unten-links = Katakomben, unten-rechts = Mechanik.
export function viertelAt(grid, x, y) {
  const left = x < grid.width / 2;
  const top = y < grid.height / 2;
  if (top && left) return 'handel';
  if (top && !left) return 'pilz';
  if (!top && left) return 'katakomben';
  return 'mechanik';
}

// Weist jeder Wandzelle die Textur-ID ihres Viertels zu (statt Zufallstextur).
export function paintWalls(grid) {
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.get(x, y) > 0) {
        grid.set(x, y, VIERTEL[viertelAt(grid, x, y)].wall);
      }
    }
  }
}

export function isDanger(viertelId) {
  return !!(VIERTEL[viertelId] && VIERTEL[viertelId].danger);
}
