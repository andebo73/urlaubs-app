// Begehbare Spielwelt für Code-Garten: Position, Blickrichtung, Springen und
// Fallen auf einer schwebenden Rasen-Plattform (wie eine Roblox-Map). In der
// Mitte steht ein Brunnen, drum herum liegen die Respawn-Punkte. Fällt man von
// der Plattform, taucht man an einem dieser Punkte wieder auf.
// Reine Logik ohne DOM und ohne Laufzeit-Zufall -> vollständig testbar.
//
// Koordinaten: X = Ost, Z = "in die Ferne" (Nord), Y = oben. 1 Einheit ~ 1 Stud.

export const FIELD = 24;                       // halbe Kantenlänge der Plattform
export const FOUNTAIN = { x: 0, z: 0, r: 2.9 }; // Brunnen in der Mitte (mit Kollision)

// Respawn-Punkte im Ring um den Brunnen.
export const RESPAWN_POINTS = (() => {
  const pts = [];
  const R = 7;
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * R, z: Math.sin(a) * R });
  }
  return pts;
})();

const SPEED = 9;       // Studs pro Sekunde
const TURN = 2.6;      // Bogenmaß pro Sekunde (Tastatur-Drehen)
const GRAVITY = 55;    // Studs pro Sekunde²
const JUMP_V = 22;     // Absprung-Geschwindigkeit
const RESPAWN_Y = -26; // fällt man tiefer, wird man ge-respawnt

// Feste Deko (mit Kollisionsradius bei Bäumen). Büsche/Blumen blockieren nicht.
export const TREES = [
  { x: -15, z: 9 }, { x: 13, z: 15 }, { x: 17, z: -7 },
  { x: -11, z: -13 }, { x: 6, z: 20 }, { x: -19, z: -3 }, { x: 20, z: 6 },
];
export const BUSHES = [
  { x: -6, z: 12 }, { x: 9, z: 4 }, { x: -13, z: -6 }, { x: 4, z: -10 },
  { x: 14, z: 1 }, { x: -3, z: 18 }, { x: 11, z: -14 }, { x: -17, z: 14 },
];

// Deterministisch gestreute Blumen (eigener LCG); nichts direkt im Brunnen.
export const FLOWERS = (() => {
  let s = 424242;
  const rnd = () => {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const arr = [];
  while (arr.length < 34) {
    const x = (rnd() * 2 - 1) * (FIELD - 2);
    const z = (rnd() * 2 - 1) * (FIELD - 2);
    if (Math.hypot(x, z) < FOUNTAIN.r + 1.5) continue;
    arr.push({ x, z, variant: Math.floor(rnd() * 5) });
  }
  return arr;
})();

export class World {
  constructor() {
    this.respawnCount = 0;
    this.reset();
  }

  reset() {
    this.respawnIndex = 0;
    this.respawnCount = 0;
    this.walkPhase = 0;
    this.moving = false;
    this._spawnAt(0);
  }

  _spawnAt(i) {
    const p = RESPAWN_POINTS[i % RESPAWN_POINTS.length];
    this.x = p.x;
    this.z = p.z;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.yaw = Math.atan2(-p.x, -p.z); // Blick zum Brunnen
  }

  respawn() {
    this.respawnIndex++;
    this.respawnCount++;
    this._spawnAt(this.respawnIndex);
  }

  forward() {
    return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
  }
  right() {
    return { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
  }

  // Steht der Punkt über der Plattform?
  onPlatform(x = this.x, z = this.z) {
    return Math.abs(x) <= FIELD && Math.abs(z) <= FIELD;
  }

  // Kamera hinter/über dem Avatar (folgt auch der Höhe beim Springen/Fallen).
  camera() {
    const f = this.forward();
    const CAM_DIST = 10.5;
    const CAM_H = 6;
    return {
      x: this.x - f.x * CAM_DIST,
      y: this.y + CAM_H,
      z: this.z - f.z * CAM_DIST,
      yaw: this.yaw,
      pitch: 0.44,
    };
  }

  applyTurn(delta) {
    if (delta) this.yaw += delta;
  }

  // Ein Simulationsschritt. controls: { move, strafe, turn, jump }.
  update(dt, controls = {}) {
    const move = clamp(controls.move || 0, -1, 1);
    const strafe = clamp(controls.strafe || 0, -1, 1);
    const turn = clamp(controls.turn || 0, -1, 1);

    this.yaw += turn * TURN * dt;

    // Horizontale Bewegung (auch in der Luft steuerbar).
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
    const bx = this.x, bz = this.z;
    const p = this._resolveXZ(this.x + dx * step, this.z + dz * step);
    this.x = p.x;
    this.z = p.z;

    // Vertikale Physik: Springen, Schwerkraft, Boden/Void.
    if (controls.jump && this.grounded) {
      this.vy = JUMP_V;
      this.grounded = false;
    }
    this.vy -= GRAVITY * dt;
    this.y += this.vy * dt;

    if (this.onPlatform() && this.y <= 0) {
      this.y = 0;
      this.vy = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    // Zu tief gefallen -> Respawn am Brunnen.
    if (this.y < RESPAWN_Y) this.respawn();

    const hdist = Math.hypot(this.x - bx, this.z - bz);
    this.moving = hdist > 1e-4;
    if (this.moving && this.grounded) this.walkPhase += hdist * 1.7;
    return this.snapshot();
  }

  // Horizontale Kollision: Brunnen + Bäume (nur solange man über der Plattform
  // ist). Eine großzügige Außengrenze verhindert unendliches Weglaufen.
  _resolveXZ(x, z) {
    const lim = FIELD + 12;
    x = clamp(x, -lim, lim);
    z = clamp(z, -lim, lim);
    if (this.onPlatform(x, z)) {
      ({ x, z } = pushOut(x, z, FOUNTAIN.x, FOUNTAIN.z, FOUNTAIN.r + 0.6));
      for (const t of TREES) {
        ({ x, z } = pushOut(x, z, t.x, t.z, 1.2));
      }
    }
    return { x, z };
  }

  snapshot() {
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      yaw: this.yaw,
      vy: this.vy,
      grounded: this.grounded,
      onPlatform: this.onPlatform(),
      moving: this.moving,
      respawnCount: this.respawnCount,
    };
  }
}

// Schiebt (x,z) aus einem Kreis (cx,cz,minDist) heraus.
function pushOut(x, z, cx, cz, minDist) {
  const dx = x - cx;
  const dz = z - cz;
  const d = Math.hypot(dx, dz);
  if (d < minDist && d > 1e-6) {
    return { x: cx + (dx / d) * minDist, z: cz + (dz / d) * minDist };
  }
  return { x, z };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
