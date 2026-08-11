// Code-Katalog für Code-Garten. Reine Daten/Logik, kein DOM.
// Ein Code schaltet genau ein Item frei. Codes werden vor dem Vergleich
// normalisiert (getrimmt, Großbuchstaben, Leerzeichen entfernt), damit die
// Eingabe tolerant ist ("  woof " == "WOOF").

// Code -> Item-Id (siehe items.js)
export const CODES = {
  WILLKOMMEN:  'stern',
  RASEN2026:   'rasenmaeher',
  GLUECK:      'blume',
  PIZZAPARTY:  'pizza',
  HUTAB:       'hut',
  SKATE:       'skateboard',
  WOOF:        'haustier_hund',
  NINJA:       'schwert',
  TURBO:       'turbo_schuhe',
  REGENBOGEN:  'regenbogen',
  ZUMMOND:     'rakete',
  KRONE:       'krone',
  DRACHE:      'haustier_drache',
  DIAMANT:     'diamant',
};

// Diese Codes zeigen wir im Einlöse-Fenster als anklickbare Beispiel-Chips.
// (Bewusst nur eine Auswahl – der Rest ist zum Entdecken.)
export const EXAMPLE_CODES = ['WILLKOMMEN', 'RASEN2026', 'WOOF', 'NINJA', 'KRONE', 'TURBO'];

// Eingabe -> Vergleichsform: trimmen, Großbuchstaben, Leerzeichen raus.
export function normalizeCode(raw) {
  return String(raw == null ? '' : raw).trim().toUpperCase().replace(/\s+/g, '');
}

// Liefert die Item-Id zu einem (rohen) Code oder null.
export function codeItemId(raw) {
  return CODES[normalizeCode(raw)] || null;
}
