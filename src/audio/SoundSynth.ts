/**
 * Procedural Web Audio Synthesizer for Kingdom of Murabba Command Core
 * 100% zero-dependency, mathematical oscillator-based sound design.
 */
class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = 0.5;

  constructor() {
    this.isMuted = localStorage.getItem('snbv_audio') === 'false';
  }

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    localStorage.setItem('snbv_audio', muted ? 'false' : 'true');
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    if (!this.isMuted) {
      this.playClick();
    }
    return !this.isMuted;
  }

  public playClick() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  public playLaser(totemOvercharge = false) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = totemOvercharge ? 'sawtooth' : 'sine';
    const startFreq = totemOvercharge ? 1800 : 1200;
    const endFreq = totemOvercharge ? 160 : 300;

    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.16);

    gain.gain.setValueAtTime(totemOvercharge ? 0.09 : 0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  public playHeavyImpact() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Sub-bass thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.35);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.35);

    // Procedural noise burst for debris crunch
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

    noise.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(t);
  }

  public playShieldDeflect() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, t); // D5
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.08); // A5
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.2);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  public playCrystalCollect() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Two high bell harmonics (Golden Ratio spacing: freq * 1.618)
    const f1 = 1200;
    const f2 = 1200 * 1.618036;

    [f1, f2].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.03);

      gain.gain.setValueAtTime(0.04, t + idx * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.03 + 0.18);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + idx * 0.03);
      osc.stop(t + idx * 0.03 + 0.18);
    });
  }

  public playTotemActivate() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Harmonic arpeggio based on Φ (Golden ratio intervals)
    const baseFreq = 432;
    const chord = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 1.618036];

    chord.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.06);

      gain.gain.setValueAtTime(0.06, t + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.35);
    });
  }

  public playPhiHarmonicWave() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Deep spatial boom + rising celestial sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.6);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.7);
  }

  public playDash() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(950, t + 0.2);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  public playNodeAlert() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(740, t);
    osc.frequency.setValueAtTime(580, t + 0.08);

    gain.gain.setValueAtTime(0.03, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  public playBossWarning() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Ominous low siren with sawtooth harmonics
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.linearRampToValueAtTime(160, t + 0.4);
    osc.frequency.linearRampToValueAtTime(90, t + 0.8);

    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.85);
  }

  public playBossPhaseShift() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Frequency warp and electrical static
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.25);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.5);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.55);
  }

  public playBossDefeated() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Grand triumphant golden chord (C - E - G - B - High C)
    const freqs = [261.63, 329.63, 392.0, 493.88, 523.25, 659.25];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);

      gain.gain.setValueAtTime(0.08, t + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.08 + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 1.2);
    });
  }

  public playChapterComplete() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Radiant fanfare
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.1);

      gain.gain.setValueAtTime(0.09, t + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.1 + 0.8);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.8);
    });
  }
}

export const sound = new SoundSynthesizer();
