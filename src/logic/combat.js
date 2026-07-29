// Kampf-Logik: ein Angriff des Spielers, Konter des Gegners, XP-Vergabe.
// Reine Logik: nutzt Rng, kein DOM.

// Führt EINEN Angriff des Spielers auf einen Gegner aus.
// Danach kontert der Gegner (falls noch am Leben und Spieler noch lebt).
// Gibt ein Ergebnisobjekt für HUD/Tests zurück.
export function playerAttack(rng, player, enemy) {
  // Spielerschaden: Stärke + kleiner Zufallswurf.
  const damage = player.strength + rng.int(0, 3);
  enemy.hp = Math.max(0, enemy.hp - damage);

  const result = {
    damageDealt: damage,
    enemyDefeated: false,
    xpGained: 0,
    leveledUp: false,
    counterDamage: 0,
    playerDefeated: false,
  };

  if (enemy.hp <= 0) {
    enemy.hp = 0;
    result.enemyDefeated = true;
    result.xpGained = enemy.xpReward;
    const lvl = player.addXp(enemy.xpReward);
    result.leveledUp = lvl.leveledUp;
    return result;
  }

  // Gegner kontert.
  const counter = Math.max(1, enemy.strength + rng.int(-1, 1));
  player.takeDamage(counter);
  result.counterDamage = counter;
  result.playerDefeated = !player.isAlive();
  return result;
}
