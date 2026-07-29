// Klassen (Gilden), Rohstoffe und Stufen-Konstanten.
// Angelehnt an das Vorbild echter Live-Rollenspiel-Anlagen (Magier/Schurke/
// Krieger/Heiler, gildeneigene Rohstoffe, Aufstieg durch Abgeben von Rohstoffen),
// aber mit eigenen Namen/Werten – lizenzfrei. Reine Logik: kein DOM.

// Vier Rohstoffe, je einer pro Gilde (Farbe + Symbol/Name).
export const RESOURCES = {
  erz: { id: 'erz', name: 'Erz', color: '#e5674d' }, // rot – Kämpfer
  rune: { id: 'rune', name: 'Rune', color: '#a855f7' }, // violett – Magier
  splitter: { id: 'splitter', name: 'Kristallsplitter', color: '#4f9df6' }, // blau – Schurke
  kraut: { id: 'kraut', name: 'Heilkraut', color: '#5bbf62' }, // grün – Heiler
};

export const RESOURCE_IDS = ['erz', 'rune', 'splitter', 'kraut'];

// Die vier Klassen. `resource` = Rohstoff, der zum Aufsteigen gesammelt wird.
// `ability` ist beschreibender Text (Tür-/Licht-Rätsel folgen in einer späteren
// Ausbaustufe); in Stufe 1 wirken sich Klassen über Werte und Heilung aus.
export const CLASSES = [
  {
    id: 'kaempfer',
    name: 'Kämpfer',
    icon: 'class_kaempfer',
    color: '#e5674d',
    resource: 'erz',
    maxHp: 26,
    strength: 4,
    healBonus: 0,
    ability: 'Verteidigt sich und andere – stark im Kampf.',
  },
  {
    id: 'magier',
    name: 'Magier',
    icon: 'class_magier',
    color: '#a855f7',
    resource: 'rune',
    maxHp: 18,
    strength: 3,
    healBonus: 0,
    ability: 'Erleuchtet dunkle Bereiche wie die Katakomben.',
  },
  {
    id: 'schurke',
    name: 'Schurke',
    icon: 'class_schurke',
    color: '#4f9df6',
    resource: 'splitter',
    maxHp: 20,
    strength: 3,
    healBonus: 0,
    ability: 'Öffnet verschlossene Türen und Truhen.',
  },
  {
    id: 'heiler',
    name: 'Heiler',
    icon: 'class_heiler',
    color: '#5bbf62',
    resource: 'kraut',
    maxHp: 22,
    strength: 3,
    healBonus: 4,
    ability: 'Heilt Wunden – bekommt nach Kämpfen Leben zurück.',
  },
];

export const MAX_LEVEL = 5; // Meister-Stufe
export const RESOURCES_PER_LEVEL = 5; // 5 gildeneigene Rohstoffe pro Aufstieg

// Ausrüstung: Waffe (mehr Schaden) und Rüstung (weniger Schaden), je bis Stufe 3.
export const MAX_TIER = 3;
export const WEAPON_COST = [3, 5, 8]; // Rohstoffe für Stufe 0->1, 1->2, 2->3
export const ARMOR_COST = [3, 5, 8];

// Waffen-Sprite (Blickfeld) je Klasse.
export const WEAPONS = {
  kaempfer: 'weapon_kaempfer',
  magier: 'weapon_magier',
  schurke: 'weapon_schurke',
  heiler: 'weapon_heiler',
};

export function getClass(id) {
  return CLASSES.find((c) => c.id === id) || CLASSES[0];
}

// Der Schurke öffnet Türen/Truhen ohne Schlüssel; der Magier hat Zauberlicht.
export function canPickLocks(classId) {
  return classId === 'schurke';
}
export function hasMagicLight(classId) {
  return classId === 'magier';
}
