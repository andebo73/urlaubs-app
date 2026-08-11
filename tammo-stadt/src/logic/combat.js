// Kampf-Logik: ein Angriff des Spielers, Konter des Gegners.
// Rohstoff-Belohnung und Heiler-Heilung werden in gamestate.js abgewickelt.
// Reine Logik: nutzt Rng, kein DOM.

export function playerAttack(rng, player, enemy) {
  const damage = player.attackPower() + rng.int(0, 3);
  enemy.hp = Math.max(0, enemy.hp - damage);

  const result = {
    damageDealt: damage,
    enemyDefeated: false,
    counterDamage: 0,
    playerDefeated: false,
  };

  if (enemy.hp <= 0) {
    enemy.hp = 0;
    result.enemyDefeated = true;
    return result;
  }

  // Gegner kontert – die Rüstung verringert den Schaden.
  const counter = Math.max(1, enemy.strength + rng.int(-1, 1) - player.armorTier);
  player.takeDamage(counter);
  result.counterDamage = counter;
  result.playerDefeated = !player.isAlive();
  return result;
}
