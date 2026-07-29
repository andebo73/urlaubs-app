// Bewegung + Kollision gegen das Gitter. Reine Logik: kein DOM.
// Der Spieler hat einen kleinen Radius, damit er nicht in Wandecken klebt.

const RADIUS = 0.25;

// Prüft, ob ein Kreis mit RADIUS an (x, y) frei von Wänden steht.
function circleFree(grid, x, y) {
  // Vier Randpunkte des Kreises testen (reicht bei Zellgröße 1).
  return (
    !grid.isWallAt(x - RADIUS, y - RADIUS) &&
    !grid.isWallAt(x + RADIUS, y - RADIUS) &&
    !grid.isWallAt(x - RADIUS, y + RADIUS) &&
    !grid.isWallAt(x + RADIUS, y + RADIUS)
  );
}

// Versucht, den Spieler um (dx, dy) in Weltkoordinaten zu verschieben.
// Gleitet an Wänden entlang (Achsen einzeln). Mutiert player.x/player.y.
// Gibt true zurück, wenn sich etwas bewegt hat.
export function tryMove(grid, player, dx, dy) {
  const startX = player.x;
  const startY = player.y;

  const nextX = player.x + dx;
  if (circleFree(grid, nextX, player.y)) {
    player.x = nextX;
  }

  const nextY = player.y + dy;
  if (circleFree(grid, player.x, nextY)) {
    player.y = nextY;
  }

  return player.x !== startX || player.y !== startY;
}

// Bewegung relativ zur Blickrichtung.
// forward > 0 = vorwärts, strafe > 0 = nach rechts.
export function moveRelative(grid, player, forward, strafe) {
  const cos = Math.cos(player.angle);
  const sin = Math.sin(player.angle);
  // Vorwärts entlang der Blickrichtung, Strafe senkrecht dazu.
  const dx = cos * forward + sin * strafe;
  const dy = sin * forward - cos * strafe;
  return tryMove(grid, player, dx, dy);
}

export function rotate(player, deltaAngle) {
  player.angle += deltaAngle;
  // In [0, 2π) halten.
  const twoPi = Math.PI * 2;
  player.angle = ((player.angle % twoPi) + twoPi) % twoPi;
}
