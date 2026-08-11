// Deterministischer PRNG (mulberry32). Alle Zufälle im Spiel laufen hierüber,
// damit Labyrinth, Gegner-/Kartenplatzierung und Kampfwürfe reproduzierbar sind.
// Reine Logik: kein DOM, kein Math.random().

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Kleiner Wrapper mit bequemen Helfern rund um die Zufallsfunktion.
export class Rng {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this.next = mulberry32(this.seed);
  }

  // Float in [0, 1)
  float() {
    return this.next();
  }

  // Ganzzahl in [min, max] (inklusive)
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  // Zufälliges Element aus einem Array
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  // true mit Wahrscheinlichkeit p
  chance(p) {
    return this.next() < p;
  }
}
