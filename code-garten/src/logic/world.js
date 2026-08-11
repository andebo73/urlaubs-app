// Begehbare Spielwelt für Code-Garten: Position, Blickrichtung und Bewegung des
// Avatars auf einer flachen Rasen-Map (wie eine Roblox-Map). Reine Logik ohne
// DOM und ohne Zufall zur Laufzeit -> vollständig testbar.
//
// Koordinaten: X = Ost, Z = "in die Ferne" (Nord), Y = oben. 1 Einheit ~ 1 Stud.

export const FIELD = 24; // halbe Kantenlänge des quadratischen Spielfelds

const SPEED = 9;   // Studs pro Sekunde
const TURN = 2.6;  // Bogenmaß pro Sekunde (Tastatur-Drehen)

// Feste Deko (mit Kollisionsradius). Bäume blockieren, Büsche/Blumen nicht.
export const TREES = [
  { x: -15, z: 9 }, { x: 13, z: 15 }, { x: 17, z: -7 },
  { x: -11, z: -13 }, { x: 6, z: 20 }, { x: -19, z: -3 }, { x: 20, z: 6 },
];
export const BUSHES = [
  { x: -6, z: 12 }, { x: 9, z: 4 }, { x: -13, z: -6 }, { x: 4, z: -10 },
  { x: 14, z: 1 }, { x: -3, z: 18 }, { x: 11, z: -14 }, { x: -17, z: 14 },
];

// Deterministisch gestreute Blumen (eigener LCG statt Math.random -> stabil).
export const FLOWERS = (() => {
  let s = 424242;
  const rnd = () => {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const arr = [];
  for (let i = 0; i < 40; i++) {
    arr.push({
      x: (rnd() * 2 - 1) * (FIELD - 2),
      z: (rnd() * 2 - 1) * (FIELD - 2),
      variant: Math.floor(rnd() * 5),
    });
  }
  return arr;
})();

export class World {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 0;
    this.z = -FIELD * 0.6;
    this.yaw = 0;          // 0 = Blick nach +Z
    this.walkPhase = 0;    // für die Lauf-Animation
    this.moving = false;
  }

  forward() {
    return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
  }
  right() {
    return { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
  }

  // Kamera direkt hinter/über dem Avatar (Third-Person).
  camera() {
    const f = this.forward();
    const CAM_DIST = 10.5;
    const CAM_H = 6;
    return {
      x: this.x - f.x * CAM_DIST,
      y: CAM_H,
      z: this.z - f.z * CAM_DIST,
      yaw: this.yaw,
      pitch: 0.44,
    };
  }

  // Kamera-Drehung direkt anwenden (Ziehen/Maus).
  applyTurn(delta) {
    if (delta) this.yaw += delta;
  }

  // Ein Simulationsschritt. controls: { move:-1..1, strafe:-1..1, turn:-1..1 }.
  update(dt, controls = {}) {
    const move = clamp(controls.move || 0, -1, 1);
    const strafe = clamp(controls.strafe || 0, -1, 1);
    const turn = clamp(controls.turn || 0, -1, 1);

    this.yaw += turn * TURN * dt;

    const f = this.forward();
    const r = this.right();
    let dx = f.x * move + r.x * strafe;
    let dz = f.z * move + r.z * strafe;
    const len = Math.hypot(dx, dz);
    if (len > 1) {
      dx /= len;
      dz /= len;
    }

    const step = SPEED * dt;
    const nx = this.x + dx * step;
    const nz = this.z + dz * step;
    const before = { x: this.x, z: this.z };
    const p = this._resolve(nx, nz);
    this.x = p.x;
    this.z = p.z;

    const dist = Math.hypot(this.x - before.x, this.z - before.z);
    this.moving = dist > 1e-4;
    if (this.moving) this.walkPhase += dist * 1.7;
    return this.snapshot();
  }

  // Feldgrenzen + Baum-Kollision (schiebt den Avatar aus dem Stamm heraus).
  _resolve(x, z) {
    const lim = FIELD - 1;
    x = clamp(x, -lim, lim);
    z = clamp(z, -lim, lim);
    const minDist = 1.2;
    for (const t of TREES) {
      const dx = x - t.x;
      const dz = z - t.z;
      const d = Math.hypot(dx, dz);
      if (d < minDist && d > 1e-6) {
        x = t.x + (dx / d) * minDist;
        z = t.z + (dz / d) * minDist;
      }
    }
    return { x, z };
  }

  snapshot() {
    return { x: this.x, z: this.z, yaw: this.yaw, moving: this.moving };
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
