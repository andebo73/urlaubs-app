// Begehbare Spielwelt für Code-Garten: Position, Blickrichtung, Springen,
// Wandsprünge und Fallen auf einer schwebenden Rasen-Plattform (wie eine
// Roblox-Map). In der Mitte steht ein Brunnen mit Respawn-Ring. An der Seite
// steht ein Troll-Turm (Obby) aus farbigen Stockwerken mit beweglichen und
// verschwindenden Plattformen sowie einem Wandsprung-Schacht. Keine Checkpoints:
// Wer fällt, startet unten auf der Map. Am Ziel wird man zurück teleportiert.
// Reine Logik ohne DOM und ohne Laufzeit-Zufall -> vollständig testbar.
//
// Koordinaten: X = Ost, Z = "in die Ferne" (Nord), Y = oben. 1 Einheit ~ 1 Stud.

export const FIELD = 24;                        // halbe Kantenlänge der Plattform
export const FOUNTAIN = { x: 0, z: 0, r: 2.9 }; // Brunnen in der Mitte

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

// Troll-Turm: Stockwerke steigen entlang +X an. motion = beweglich,
// blink = verschwindend, kind:'goal' = Ziel. `top` = Höhe der Oberfläche.
export const OBBY = [
  // Stockwerk 1 – Start (orange/gelb)
  { x: 28,   z: 0,    w: 3.0, d: 3.0, top: 1.2,  color: '#ff8a3d' },
  { x: 32,   z: 2,    w: 3.0, d: 3.0, top: 2.8,  color: '#ffd23f' },
  { x: 36,   z: -2,   w: 3.0, d: 3.0, top: 4.4,  color: '#ff8a3d' },
  { x: 40,   z: 1.6,  w: 3.0, d: 3.0, top: 6.0,  color: '#ffd23f' },
  // Stockwerk 2 – verschwindende Blöcke (türkis)
  { x: 44,   z: -1.6, w: 3.0, d: 3.0, top: 7.6,  color: '#5bd1a0', blink: { period: 2.6, duty: 0.6, phase: 0.0 } },
  { x: 47.5, z: 1.6,  w: 2.4, d: 2.4, top: 9.0,  color: '#39b98a' },
  { x: 51,   z: -1.6, w: 3.0, d: 3.0, top: 10.4, color: '#5bd1a0', blink: { period: 2.4, duty: 0.58, phase: 0.4 } },
  { x: 54.5, z: 1.2,  w: 2.6, d: 2.6, top: 11.8, color: '#39b98a' },
  // Stockwerk 3 – bewegliche Plattformen (blau)
  { x: 58,   z: 0,    w: 3.0, d: 3.0, top: 13.2, color: '#4f9df6', motion: { axis: 'z', amp: 3.0, speed: 1.3 } },
  { x: 61.5, z: 0,    w: 2.4, d: 2.4, top: 14.6, color: '#3b82e0' },
  { x: 65,   z: 0,    w: 3.0, d: 3.0, top: 16.0, color: '#4f9df6', motion: { axis: 'z', amp: 3.2, speed: 1.6 } },
  // Wandsprung-Schacht (lila): unten rein, zwischen den Wänden hochspringen
  { x: 69.5, z: 0,    w: 3.2, d: 3.2, top: 17.4, color: '#a855f7' },
  { x: 70,   z: 0,    w: 3.2, d: 3.2, top: 24.8, color: '#a855f7' },
  // Stockwerk 5 – Mix (pink)
  { x: 73.5, z: 1.6,  w: 2.8, d: 2.8, top: 26.2, color: '#ff6b9d', blink: { period: 2.5, duty: 0.58, phase: 0.2 } },
  { x: 77,   z: -1.0, w: 3.0, d: 3.0, top: 27.6, color: '#ff8fb0', motion: { axis: 'z', amp: 2.0, speed: 1.5 } },
  { x: 80.5, z: 1.2,  w: 2.6, d: 2.6, top: 29.0, color: '#ff6b9d', blink: { period: 2.6, duty: 0.6, phase: 0.7 } },
  { x: 84,   z: 0,    w: 3.0, d: 3.0, top: 30.4, color: '#ff8fb0' },
  // Ziel (gold)
  { x: 88,   z: 0,    w: 5.0, d: 5.0, top: 31.8, color: '#f6b400', kind: 'goal' },
];

// Wände für Wandsprünge: zwei parallele Wände bilden den Schacht.
export const WALLS = [
  { x: 70, z: -2.1, w: 4.2, d: 0.6, y0: 17.7, y1: 26, color: '#8b3fd4' },
  { x: 70, z: 2.1,  w: 4.2, d: 0.6, y0: 17.7, y1: 26, color: '#8b3fd4' },
];

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

const SPEED = 9;
const TURN = 2.6;
const GRAVITY = 55;
const JUMP_V = 22;
const WALLJUMP_V = 20;   // Auftrieb beim Wandsprung
const WALL_PUSH = 9;     // Abstoß von der Wand (seitlich)
const WALL_SLIDE = -7;   // Mindest-Fallgeschwindigkeit an einer Wand (Gleiten)
const WALL_CD = 0.22;    // kurze Sperre zwischen zwei Wandsprüngen
const WALL_PR = 0.45;    // "Radius" des Avatars für die Wand-Kollision
const PLAYER_H = 4.5;    // Körperhöhe (für die vertikale Wand-Überlappung)
const RESPAWN_Y = -26;
const LAND_EPS = 0.25;

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
    this.camPitch = 0.44;
    this.vx = 0;
    this.vz = 0;
    this._wallTouch = null;
    this._wallCd = 0;
    this._spawnAt(0);
  }

  _spawnAt(i) {
    const p = RESPAWN_POINTS[i % RESPAWN_POINTS.length];
    this.x = p.x;
    this.z = p.z;
    this.y = 0;
    this.vy = 0;
    this.vx = 0;
    this.vz = 0;
    this.grounded = true;
    this.groundRef = null;
    this.yaw = Math.atan2(-p.x, -p.z);
    this.camPitch = 0.44;
  }

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

  _blinkState(p, time) {
    if (!p.blink) return { solid: true, alpha: 1 };
    const u = mod(time / p.blink.period + p.blink.phase, 1);
    if (u < p.blink.duty) {
      const left = p.blink.duty - u;
      const alpha = left < 0.18 ? 0.4 + 0.6 * Math.abs(Math.sin(time * 22)) : 1;
      return { solid: true, alpha };
    }
    return { solid: false, alpha: 0.16 };
  }

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
      pitch: this.camPitch,
    };
  }

  applyTurn(delta) {
    if (delta) this.yaw += delta;
  }
  // Nach oben/unten schauen (für den Turm). pitch klein = nach oben.
  applyPitch(delta) {
    if (delta) this.camPitch = clamp(this.camPitch + delta, -0.25, 1.0);
  }

  update(dt, controls = {}) {
    this._wallTouch = null;
    this._wallCd = Math.max(0, this._wallCd - dt);

    // Bewegliche Plattform trägt den Avatar mit.
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

    // Horizontale Bewegung = Eingabe + Impuls (Wandsprung-Abstoß).
    const f = this.forward();
    const r = this.right();
    let ix = f.x * move + r.x * strafe;
    let iz = f.z * move + r.z * strafe;
    const len = Math.hypot(ix, iz);
    if (len > 1) {
      ix /= len;
      iz /= len;
    }
    const mvx = ix * SPEED + this.vx;
    const mvz = iz * SPEED + this.vz;
    const bx = this.x, bz = this.z;
    const p = this._resolveXZ(this.x + mvx * dt, this.z + mvz * dt);
    this.x = p.x;
    this.z = p.z;
    const fr = Math.exp(-dt * 4);
    this.vx *= fr;
    this.vz *= fr;
    if (Math.abs(this.vx) < 0.01) this.vx = 0;
    if (Math.abs(this.vz) < 0.01) this.vz = 0;

    // Normaler Sprung vom Boden ODER Wandsprung in der Luft.
    if (controls.jump && this.grounded) {
      this.vy = JUMP_V;
      this.grounded = false;
      this.groundRef = null;
    } else if (controls.jump && !this.grounded && this._wallTouch && this._wallCd <= 0) {
      this.vy = WALLJUMP_V;
      this.vx += this._wallTouch.x * WALL_PUSH;
      this.vz += this._wallTouch.z * WALL_PUSH;
      this._wallCd = WALL_CD;
    }

    const prevY = this.y;
    this.vy -= GRAVITY * dt;
    // An einer Wand langsamer fallen (Wandgleiten) -> Zeit zum Wandsprung.
    if (!this.grounded && this._wallTouch && this.vy < WALL_SLIDE) this.vy = WALL_SLIDE;
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
    // Wände (AABB): blockieren und merken den Wandkontakt für den Wandsprung.
    for (const wl of WALLS) {
      if (!(this.y + PLAYER_H > wl.y0 && this.y < wl.y1)) continue;
      const minx = wl.x - wl.w / 2 - WALL_PR;
      const maxx = wl.x + wl.w / 2 + WALL_PR;
      const minz = wl.z - wl.d / 2 - WALL_PR;
      const maxz = wl.z + wl.d / 2 + WALL_PR;
      if (x >= minx && x <= maxx && z >= minz && z <= maxz) {
        const dl = x - minx, dr = maxx - x, db = z - minz, df = maxz - z;
        const m = Math.min(dl, dr, db, df);
        if (m === dl) { x = minx; this._wallTouch = { x: -1, z: 0 }; }
        else if (m === dr) { x = maxx; this._wallTouch = { x: 1, z: 0 }; }
        else if (m === db) { z = minz; this._wallTouch = { x: 0, z: -1 }; }
        else { z = maxz; this._wallTouch = { x: 0, z: 1 }; }
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
      touchingWall: !!this._wallTouch,
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
