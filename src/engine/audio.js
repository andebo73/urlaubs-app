// Soundeffekte – vollständig per WebAudio synthetisiert (kleine Retro-Beeps).
// Keine externen Audiodateien -> lizenzfrei. Render-nah (nutzt window/AudioContext).

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  // Erzeugt/aktiviert den AudioContext (muss durch eine Nutzergeste ausgelöst
  // werden – Autoplay-Richtlinien der Browser).
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        try {
          this.ctx = new AC();
        } catch (e) {
          this.ctx = null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  // Einzelnen Ton einplanen.
  _tone(freq, start, dur, type = 'square', vol = 0.12) {
    const t0 = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _seq(notes, type = 'square', vol = 0.12) {
    let t = 0;
    for (const [freq, dur] of notes) {
      this._tone(freq, t, dur, type, vol);
      t += dur * 0.9;
    }
  }

  play(name) {
    if (this.muted) return;
    this.ensure();
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'pickup':
        this._tone(660, 0, 0.09, 'square', 0.1);
        break;
      case 'key':
        this._seq([[660, 0.07], [880, 0.1]], 'square', 0.1);
        break;
      case 'chest':
        this._seq([[523, 0.09], [659, 0.09], [784, 0.14]], 'triangle', 0.12);
        break;
      case 'door':
        this._tone(180, 0, 0.16, 'sawtooth', 0.09);
        break;
      case 'hit':
        this._tone(200, 0, 0.07, 'square', 0.12);
        break;
      case 'defeat':
        this._seq([[440, 0.08], [220, 0.14]], 'square', 0.11);
        break;
      case 'level':
        this._seq([[523, 0.1], [659, 0.1], [784, 0.1], [1046, 0.18]], 'triangle', 0.13);
        break;
      case 'buy':
        this._seq([[784, 0.08], [1046, 0.12]], 'triangle', 0.12);
        break;
      case 'quest':
        this._seq([[587, 0.08], [880, 0.12]], 'triangle', 0.1);
        break;
      case 'shop':
        this._seq([[440, 0.06], [550, 0.08]], 'triangle', 0.09);
        break;
      case 'lose':
        this._seq([[330, 0.12], [220, 0.14], [160, 0.22]], 'sawtooth', 0.12);
        break;
      case 'error':
        this._tone(150, 0, 0.1, 'square', 0.08);
        break;
      default:
        break;
    }
  }
}
