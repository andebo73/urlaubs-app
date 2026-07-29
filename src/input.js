// Eingabe: Tastatur -> Absichten. Dünn gehalten, hält nur den Tastenzustand.
// Render-nah (nutzt window/document), aber ruft nur GameState-Methoden auf.

export class InputState {
  constructor() {
    this.keys = new Set();
    // Aktions-Flags, die pro Frame einmalig ausgewertet werden.
    this.pendingInteract = false;
    this.pendingAttack = false;
    this.pendingFlee = false;
    this.pendingRestart = false;
    // Absichten aus Touch-Steuerung (werden direkt gesetzt).
    this.touch = { forward: 0, strafe: 0, turn: 0 };
  }

  attach(target = window) {
    target.addEventListener('keydown', (e) => this._onKey(e, true));
    target.addEventListener('keyup', (e) => this._onKey(e, false));
  }

  _onKey(e, down) {
    const k = e.key.toLowerCase();
    const tracked = [
      'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
      'w', 'a', 's', 'd', 'q', 'e', ' ',
    ];
    if (tracked.includes(k)) e.preventDefault();

    if (down) {
      // Einmalaktionen bei Tastendruck (nicht Halten).
      if (k === ' ' || k === 'enter') this.pendingInteract = true;
      if (k === 'f') this.pendingAttack = true;
      if (k === 'escape') this.pendingFlee = true;
      if (k === 'r') this.pendingRestart = true;
      this.keys.add(k);
    } else {
      this.keys.delete(k);
    }
  }

  has(...ks) {
    return ks.some((k) => this.keys.has(k));
  }

  // Liefert die aktuellen kontinuierlichen Absichten (aus Tastatur + Touch).
  axes() {
    let forward = 0;
    let strafe = 0;
    let turn = 0;
    if (this.has('arrowup', 'w')) forward += 1;
    if (this.has('arrowdown', 's')) forward -= 1;
    if (this.has('a')) strafe -= 1;
    if (this.has('d')) strafe += 1;
    if (this.has('arrowleft', 'q')) turn -= 1;
    if (this.has('arrowright', 'e')) turn += 1;

    forward += this.touch.forward;
    strafe += this.touch.strafe;
    turn += this.touch.turn;

    return {
      forward: Math.max(-1, Math.min(1, forward)),
      strafe: Math.max(-1, Math.min(1, strafe)),
      turn: Math.max(-1, Math.min(1, turn)),
    };
  }

  // Einmalaktionen abgreifen und zurücksetzen.
  consume() {
    const out = {
      interact: this.pendingInteract,
      attack: this.pendingAttack,
      flee: this.pendingFlee,
      restart: this.pendingRestart,
    };
    this.pendingInteract = false;
    this.pendingAttack = false;
    this.pendingFlee = false;
    this.pendingRestart = false;
    return out;
  }
}
