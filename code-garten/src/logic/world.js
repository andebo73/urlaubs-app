// Begehbare Spielwelt für Code-Garten: Position, Blickrichtung, Springen und
// Fallen auf einer schwebenden Rasen-Plattform (wie eine Roblox-Map). In der
// Mitte steht ein Brunnen mit Respawn-Ring. An der Seite gibt es eine längere
// Obby (Kletter-Parcours) mit beweglichen und verschwindenden Plattformen –
// ohne Checkpoints: Wer fällt, startet wieder auf der Map. Am Ziel wird man
// zurück teleportiert.
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

// Obby: schwebende Plattformen an der +X-Seite, ansteigend und im Zickzack.
//  motion: bewegliche Plattform  ·  blink: verschwindende Plattform
//  kind: 'goal' = Ziel.  `top` = Höhe der Oberfläche.
export const OBBY = [
  { x: 28,   z: 0,    w: 3.2, d: 3.2, top: 1.2,  color: '#ff8a3d' },
  { x: 32.5, z: 2.5,  w: 3.0, d: 3.0, top: 2.4,  color: '#ffd23f' },
  { x: 37,   z: -2.5, w: 3.0, d: 3.0, top: 3.6,  color: '#5bd1a0', blink: { period: 2.6, duty: 0.6, phase: 0.0 } },
  { x: 41.5, z: 1.5,  w: 3.0, d: 3.0, top: 4.8,  color: '#c77dff' },
  { x: 46,   z: -1.5, w: 3.0, d: 3.0, top: 6.0,  color: '#4f9df6', motion: { axis: 'z', amp: 3.0, speed: 1.3 } },
  { x: 50.5, z: 2,    w: 3.0, d: 3.0, top: 7.2,  color: '#ff6b9d', blink: { period: 2.4, duty: 0.58, phase: 0.35 } },
  { x: 55,   z: -2,   w: 2.4, d: 2.4, top: 8.4,  color: '#ffd23f' },
  { x: 59.5, z: 1.5,  w: 3.0, d: 3.0, top: 9.6,  color: '#5bd1a0', blink: { period: 2.6, duty: 0.6, phase: 0.7 } },
  { x: 64,   z: -1,   w: 3.0, d: 3.0, top: 10.8, color: '#4f9df6', motion: { axis: 'x', amp: 2.4, speed: 1.1 } },
  { x: 69,   z: 2,    w: 3.0, d: 3.0, top: 12.0, color: '#ff8a3d' },
  { x: 73.5, z: -2,   w: 2.6, d: 2.6, top: 13.2, color: '#c77dff', blink: { period: 2.5, duty: 0.58, phase: 0.2 } },
  { x: 78,   z: 1,    w: 2.6, d: 2.6, top: 14.4, color: '#ffd23f' },
  { x: 82.5, z: 0,    w: 3.2, d: 3.2, top: 15.4, color: '#ff6b9d', motion: { axis: 'z', amp: 3.5, speed: 1.6 } },
  { x: 88,   z: 0,    w: 5.0, d: 5.0, top: 16.4, color: '#f6b400', kind: 'goal' },
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
const LAND_EPS = 0.25; // Toleranz beim Aufsetzen

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
    this.groundRef = null;
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

  // Nach dem Obby-Abschluss zurück auf die Map.
  returnToStart() {
    this.respawnIndex = 0;
    this._spawnAt(0);
  }

  respawn() {
    this.respawnCount++;
    this.respawnIndex++;
    this._spawnAt(this.respawnIndex);
  }

  forward() {
    return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
  }
  right() {
    return { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
  }

  onPlatform(x = this.x, z = this.z) {
    return Math.abs(x) <= FIELD && Math.abs(z) <= FIELD;
  }

  // Ist eine (verschwindende) Plattform gerade fest?
  _blinkState(p, time) {
    if (!p.blink) return { solid: true, alpha: 1 };
    const u = mod(time / p.blink.period + p.blink.phase, 1);
    if (u < p.blink.duty) {
      const left = p.blink.duty - u;
      // Kurz vor dem Verschwinden warnend flackern.
      const alpha = left < 0.18 ? 0.4 + 0.6 * Math.abs(Math.sin(time * 22)) : 1;
      return { solid: true, alpha };
    }
    return { solid: false, alpha: 0.16 }; // Geist – kommt gleich wieder
  }

  // Aktueller Zustand einer Obby-Plattform (Bewegung + Verschwinden).
  obbyPose(p, time = this.time) {
    let x = p.x;
    let z = p.z;
    if (p.motion) {
      const o = Math.sin(time * p.motion.speed) * p.motion.amp;
      if (p.motion.axis === 'x') x += o;
      else z += o;
    }
    const b = this._blinkState(p, time);
    return { x, z, w: p.w, d: p.d, top: p.top, color: p.color, kind: p.kind, ref: p, solid: b.solid, alpha: b.alpha };
  }

  obbyPoses() {
    return OBBY.map((p) => this.obbyPose(p));
  }

  // Alle festen Oberflächen: Haupt-Plattform + feste Obby-Plattformen.
  _solids() {
    const arr = [{ x: 0, z: 0, w: 2 * FIELD, d: 2 * FIELD, top: 0, kind: 'lawn', ref: null }];
    for (const p of OBBY) {
      const q = this.obbyPose(p);
      if (q.solid) arr.push(q);
    }
    return arr;
  }

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
      if (land.ref && land.ref.kind === 'goal') this.reachedGoal = true;
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
      reachedGoal: this.reachedGoal,
    };
  }
}

function mod(a, n) {
  return ((a % n) + n) % n;
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
