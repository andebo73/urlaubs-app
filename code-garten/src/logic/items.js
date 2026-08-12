// Reine Item-Daten für Code-Garten. Kein DOM, keine externen Assets.
// Item-Icons sind System-Emoji (wie auf der Startseite), damit die App ohne
// eigene Bilddateien auskommt und trotzdem bunt aussieht.

// Seltenheitsstufen mit Farbe und Sortier-Reihenfolge (höher = seltener).
export const RARITIES = {
  'gewöhnlich': { label: 'gewöhnlich', color: '#5bb04a', order: 0 },
  'selten':     { label: 'selten',     color: '#4f9df6', order: 1 },
  'episch':     { label: 'episch',     color: '#a855f7', order: 2 },
  'legendär':   { label: 'legendär',   color: '#f6b400', order: 3 },
};

// Alle Items, die man im Spiel per Code einlösen kann.
// id -> { name, emoji, rarity, blurb }
export const ITEMS = {
  stern:          { name: 'Superstar',        emoji: '⭐', rarity: 'gewöhnlich', blurb: 'Ein glänzender Stern für dein Profil.' },
  rasenmaeher:    { name: 'Rasenmäher',       emoji: '🚜', rarity: 'gewöhnlich', blurb: 'Mäht deine Wiese blitzschnell.' },
  blume:          { name: 'Glücksblume',      emoji: '🌻', rarity: 'gewöhnlich', blurb: 'Bringt Glück im Garten.' },
  pizza:          { name: 'Pizza',            emoji: '🍕', rarity: 'gewöhnlich', blurb: 'Ein Snack für zwischendurch.' },
  hut:            { name: 'Zylinder',         emoji: '🎩', rarity: 'selten',     blurb: 'Ein schicker Hut für deinen Avatar.' },
  skateboard:     { name: 'Skateboard',       emoji: '🛹', rarity: 'selten',     blurb: 'Roll cool über die Wiese.' },
  haustier_hund:  { name: 'Welpe',            emoji: '🐶', rarity: 'selten',     blurb: 'Ein treuer Begleiter, der dir folgt.' },
  schwert:        { name: 'Ninja-Schwert',    emoji: '🗡️', rarity: 'episch',     blurb: 'Scharf und leise wie ein Ninja.' },
  turbo_schuhe:   { name: 'Turbo-Schuhe',     emoji: '👟', rarity: 'episch',     blurb: 'Renne doppelt so schnell.' },
  regenbogen:     { name: 'Regenbogen-Spur',  emoji: '🌈', rarity: 'episch',     blurb: 'Hinterlasse eine bunte Spur.' },
  rakete:         { name: 'Jetpack',          emoji: '🚀', rarity: 'episch',     blurb: 'Hebt dich in die Luft.' },
  krone:          { name: 'Goldene Krone',    emoji: '👑', rarity: 'legendär',   blurb: 'Die Krone der Meister.' },
  haustier_drache:{ name: 'Drachen-Baby',     emoji: '🐉', rarity: 'legendär',   blurb: 'Ein legendärer Drachen-Begleiter.' },
  diamant:        { name: 'Diamant',          emoji: '💎', rarity: 'legendär',   blurb: 'Der seltenste Schatz überhaupt.' },
};

export function getItem(id) {
  return ITEMS[id] || null;
}

export function rarityColor(rarity) {
  const r = RARITIES[rarity];
  return r ? r.color : '#888';
}
