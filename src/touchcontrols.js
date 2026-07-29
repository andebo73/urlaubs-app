// On-Screen-Steuerung für Smartphones: virtueller Joystick (Gehen/Strafen),
// Wisch-Drehen auf der 3D-Ansicht und große Aktionsknöpfe.
// Render-nah (DOM); schreibt in InputState bzw. dreht die Kamera direkt.

export class TouchControls {
  constructor(container, input, viewEl, game) {
    this.input = input;
    this.game = game;
    this.viewEl = viewEl;
    this.turnFactor = 0.005; // Radiant pro gewischtem Pixel
    this._build(container);
    this._wireJoystick();
    this._wireButtons();
    this._wireDragTurn();
  }

  _build(container) {
    container.innerHTML = `
      <div id="tc-joystick" class="tc-joy" aria-label="Bewegen">
        <div id="tc-knob" class="tc-knob"></div>
      </div>
      <div class="tc-buttons">
        <button id="tc-take" class="tc-btn tc-take" type="button">Nehmen</button>
        <button id="tc-attack" class="tc-btn tc-attack" type="button">Angreifen</button>
        <button id="tc-flee" class="tc-btn tc-flee" type="button">Fliehen</button>
      </div>
    `;
    this.joy = container.querySelector('#tc-joystick');
    this.knob = container.querySelector('#tc-knob');
    this.btnTake = container.querySelector('#tc-take');
    this.btnAttack = container.querySelector('#tc-attack');
    this.btnFlee = container.querySelector('#tc-flee');
  }

  _wireJoystick() {
    const maxR = 40;
    let active = false;
    let id = null;

    const reset = () => {
      active = false;
      id = null;
      this.input.touch.forward = 0;
      this.input.touch.strafe = 0;
      this.knob.style.transform = 'translate(0px,0px)';
    };

    const move = (clientX, clientY) => {
      const rect = this.joy.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      this.knob.style.transform = `translate(${dx}px,${dy}px)`;
      this.input.touch.strafe = Math.max(-1, Math.min(1, dx / maxR));
      this.input.touch.forward = Math.max(-1, Math.min(1, -dy / maxR));
    };

    this.joy.addEventListener('pointerdown', (e) => {
      active = true;
      id = e.pointerId;
      this.joy.setPointerCapture(id);
      move(e.clientX, e.clientY);
      e.preventDefault();
    });
    this.joy.addEventListener('pointermove', (e) => {
      if (!active || e.pointerId !== id) return;
      move(e.clientX, e.clientY);
      e.preventDefault();
    });
    const end = (e) => {
      if (e.pointerId === id) reset();
    };
    this.joy.addEventListener('pointerup', end);
    this.joy.addEventListener('pointercancel', end);
  }

  _wireButtons() {
    const tap = (el, fn) => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        fn();
      });
    };
    tap(this.btnTake, () => {
      this.input.pendingInteract = true;
    });
    tap(this.btnAttack, () => {
      // Angreifen dient im Kampf zum Angriff, sonst zum Interagieren.
      this.input.pendingAttack = true;
      this.input.pendingInteract = true;
    });
    tap(this.btnFlee, () => {
      this.input.pendingFlee = true;
      this.input.pendingRestart = true; // im Ende-Bildschirm = Neustart
    });
  }

  // Wischen auf der 3D-Ansicht dreht die Kamera (auch mit Maus am Desktop).
  _wireDragTurn() {
    let dragging = false;
    let lastX = 0;
    let id = null;

    this.viewEl.addEventListener('pointerdown', (e) => {
      dragging = true;
      id = e.pointerId;
      lastX = e.clientX;
    });
    this.viewEl.addEventListener('pointermove', (e) => {
      if (!dragging || e.pointerId !== id) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      if (this.game && this.game.mode === 'explore') {
        this.game.rotateBy(dx * this.turnFactor);
      }
    });
    const end = (e) => {
      if (e.pointerId === id) dragging = false;
    };
    this.viewEl.addEventListener('pointerup', end);
    this.viewEl.addEventListener('pointercancel', end);
    this.viewEl.addEventListener('pointerleave', end);
  }
}
