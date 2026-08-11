// Begehbare Spielwelt für Code-Garten: Position, Blickrichtung, Springen und
// Fallen auf einer schwebenden Rasen-Plattform (wie eine Roblox-Map). In der
// Mitte steht ein Brunnen mit Respawn-Ring. An der Seite gibt es eine kleine
// Obby (Kletter-Parcours) aus schwebenden Plattformen mit Checkpoint und Ziel.
// Reine Logik ohne DOM und ohne Laufzeit-Zufall -> vollständig testbar.
//
// Koordinaten: X = Ost, Z = "in die Ferne" (Nord), Y = oben. 1 Einheit ~ 1 Stud.

export const FIELD = 24;                        // halbe Kantenlänge der Plattform
export const FOUNTAIN = { x: 0, z: 0, r: 2.9 }; // Brunnen in der Mitte

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

// Obby: schwebende Plattformen an der +X-Seite, ansteigend, mit Checkpoint,
// beweglicher Plattform und Ziel. `top` = Höhe der Oberfläche.
export const OBBY = [
  { x: 28, z: 0, w: 3.2, d: 3.2, top: 1.2, color: '#ff8a3d' },
  { x: 32.5, z: 2.5, w: 3.2, d: 3.2, top: 2.6, color: '#ffd23f' },
  { x: 37, z: -2, w: 3.2, d: 3.2, top: 4.0, color: '#5bd1a0' },
  { x: 41.5, z: 1.5, w: 4.4, d: 4.4, top: 5.2, color: '#4f9df6', kind: 'checkpoint' },
  { x: 46, z: -1.5, w: 3.2, d: 3.2, top: 6.6, color: '#c77dff' },
  { x: 50.5, z: 1.5, w: 3.2, d: 3.2, top: 8.0, color: '#ff8a3d' },
  { x: 55, z: 0, w: 3.4, d: 3.4, top: 9.2, color: '#ffd23f', motion: { axis: 'z', amp: 3, speed: 1.3 } },
  { x: 60, z: 0, w: 5, d: 5, top: 10.4, color: '#f6b400', kind: 'goal' },
];

// Feste Deko (Bäume mit Kollision). Büsche/Blumen blockieren nicht.
export const TREES = [
  { x: -15, z: 9 }, { x: 13, z: 15 }, { x: 17, z: -7 },
  { x: -11, z: -13 }, { x: 6, z: 20 }, { x: -19, z: -3 }, { x: 20, z: 6 },
];
export const BUSHES = [
  { x: -6, z: 12 }, { x: 9, z: 4 }, { x: -13, z: -6 }, { x: 4, z: -10 },
  { x: 14, z: 1 }, { x: -3, z: 18 }, { x: 11, z: -14 }, { x: -17, z: 14 },
];
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

const SPEED = 9;       // Studs pro Sekunde
const TURN = 2.6;      // Bogenmaß pro Sekunde
const GRAVITY = 55;    // Studs pro Sekunde²
const JUMP_V = 22;     // Absprung-Geschwindigkeit
const RESPAWN_Y = -26; // fällt man tiefer, wird man ge-respawnt
const LAND_EPS = 0.25; // Toleranz beim Aufsetzen auf eine Plattform

export class World {
  constructor() {
    this.reset();
  }

  reset() {
    this.time = 0;
    this.respawnIndex = 0;
    this.respawnCount = 0;
    this.walkPhase = 0;
    this.moving = false;
    this.groundRef = null;   // Plattform, auf der man steht (für bewegliche)
    this.checkpoint = null;  // {x,y,z,yaw} oder null
    this.checkpointRef = null;
    this.checkpointCount = 0;
    this.reachedGoal = false;
    this._spawnAt(0);
  }

  _spawnAt(i) {
    const p = RESPAWN_POINTS[i % RESPAWN_POINTS.length];
    this.x = p.x;
    this.z = p.z;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.groundRef = null;
    this.yaw = Math.atan2(-p.x, -p.z); // Blick zum Brunnen
  }

  respawn() {
    this.respawnCount++;
    if (this.checkpoint) {
      const c = this.checkpoint;
      this.x = c.x;
      this.z = c.z;
      this.y = c.y;
      this.vy = 0;
      this.grounded = true;
      this.groundRef = null;
      this.yaw = c.yaw;
    } else {
      this.respawnIndex++;
      this._spawnAt(this.respawnIndex);
    }
  }

  forward() {
    return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
  }
  right() {
    return { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
  }

  // Über der Haupt-Plattform (Rasen)?
  onPlatform(x = this.x, z = this.z) {
    return Math.abs(x) <= FIELD && Math.abs(z) <= FIELD;
  }

  // Aktuelle Position einer Obby-Plattform (berücksichtigt Bewegung).
  obbyPose(p, time = this.time) {
    let x = p.x;
    let z = p.z;
    if (p.motion) {
      const o = Math.sin(time * p.motion.speed) * p.motion.amp;
      if (p.motion.axis === 'x') x += o;
      else z += o;
    }
    return { x, z, w: p.w, d: p.d, top: p.top, color: p.color, kind: p.kind, ref: p };
  }

  obbyPoses() {
    return OBBY.map((p) => this.obbyPose(p));
  }

  // Alle festen Oberflächen: Haupt-Plattform + Obby.
  _solids() {
    return [
      { x: 0, z: 0, w: 2 * FIELD, d: 2 * FIELD, top: 0, kind: 'lawn', ref: null },
      ...this.obbyPoses(),
    ];
  }

  // Höchste Oberfläche, auf die man in diesem Schritt aufsetzt (oder null).
  _landing(prevY, newY, x, z) {
    let best = null;
    for (const s of this._solids()) {
      if (x < s.x - s.w / 2 || x > s.x + s.w / 2) continue;
      if (z < s.z - s.d / 2 || z > s.z + s.d / 2) continue;
      if (prevY >= s.top - LAND_EPS && newY <= s.top + LAND_EPS) {
        if (!best || s.top > best.top) best = s;
      }
    }
    return best;
  }

  // Kamera hinter/über dem Avatar (folgt Höhe beim Springen/Fallen).
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
    // Bewegliche Plattform "trägt" den Avatar, solange er darauf steht.
    if (this.grounded && this.groundRef && this.groundRef.motion) {
      const before = this.obbyPose(this.groundRef, this.time);
      this.time += dt;
      const after = this.obbyPose(this.groundRef, this.time);
      this.x += after.x - before.x;
      this.z += after.z - before.z;
    } else {
      this.time += dt;
    }

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

    // Vertikale Physik.
    if (controls.jump && this.grounded) {
      this.vy = JUMP_V;
      this.grounded = false;
      this.groundRef = null;
    }
    const prevY = this.y;
    this.vy -= GRAVITY * dt;
    this.y += this.vy * dt;

    const land = this.vy <= 0 ? this._landing(prevY, this.y, this.x, this.z) : null;
    if (land) {
      this.y = land.top;
      this.vy = 0;
      this.grounded = true;
      this.groundRef = land.ref;
      this._touch(land);
    } else {
      this.grounded = false;
      this.groundRef = null;
    }

    if (this.y < RESPAWN_Y) this.respawn();

    const hdist = Math.hypot(this.x - bx, this.z - bz);
    this.moving = hdist > 1e-4;
    if (this.moving && this.grounded) this.walkPhase += hdist * 1.7;
    return this.snapshot();
  }

  // Checkpoint/Ziel merken, wenn man darauf landet.
  _touch(land) {
    if (!land.ref) return;
    const kind = land.ref.kind;
    if (kind === 'checkpoint' || kind === 'goal') {
      if (this.checkpointRef !== land.ref) {
        this.checkpointRef = land.ref;
        this.checkpointCount++;
        this.checkpoint = { x: land.ref.x, y: land.ref.top, z: land.ref.z, yaw: Math.PI / 2 };
      }
    }
    if (kind === 'goal') this.reachedGoal = true;
  }

  // Horizontale Kollision (Brunnen + Bäume) – nur über der Haupt-Plattform.
  _resolveXZ(x, z) {
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
      checkpointCount: this.checkpointCount,
      reachedGoal: this.reachedGoal,
    };
  }
}

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
