import type { AudioSettings } from '../game/types';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicInterval: number | null = null;
  private musicStep = 0;

  private settings: AudioSettings = {
    masterVolume: 0.8,
    sfxVolume: 0.85,
    musicVolume: 0.35,
    muted: false,
  };

  public updateSettings(next: AudioSettings): void {
    this.settings = { ...next };
    if (this.masterGain && this.sfxGain && this.musicGain && this.ctx) {
      const now = this.ctx.currentTime;
      const master = next.muted ? 0 : next.masterVolume;
      this.masterGain.gain.setTargetAtTime(master, now, 0.03);
      this.sfxGain.gain.setTargetAtTime(next.sfxVolume, now, 0.03);
      this.musicGain.gain.setTargetAtTime(next.musicVolume, now, 0.03);
    }
    if (next.muted || next.musicVolume <= 0.01) {
      this.stopMusic();
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();

        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.masterGain.gain.value = this.settings.muted ? 0 : this.settings.masterVolume;
        this.sfxGain.gain.value = this.settings.sfxVolume;
        this.musicGain.gain.value = this.settings.musicVolume;
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public startMusic(): void {
    if (this.settings.muted || this.settings.musicVolume <= 0.01) return;
    if (this.musicInterval !== null) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const chords = [
      [220.0, 277.18, 329.63, 415.3], // Amaj7
      [196.0, 246.94, 293.66, 369.99], // Gmaj7
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [164.81, 196.0, 246.94, 293.66], // Em7
    ];

    const playPad = () => {
      if (!this.ctx || !this.musicGain || this.settings.muted || this.settings.musicVolume <= 0.01) return;
      const chord = chords[this.musicStep % chords.length];
      this.musicStep += 1;
      const now = this.ctx.currentTime;
      for (const freq of chord) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(now);
        osc.stop(now + 3.9);
      }
    };

    playPad();
    this.musicInterval = window.setInterval(playPad, 3800);
  }

  public stopMusic(): void {
    if (this.musicInterval !== null) {
      window.clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  public playClick(): void {
    if (this.settings.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.045);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playDiceRoll(): void {
    if (this.settings.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // 4 rapid wooden/ivory rattle knocks
    const offsets = [0, 0.08, 0.17, 0.28];
    offsets.forEach((off, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const baseFreq = 260 + idx * 35 + Math.random() * 40;
      osc.frequency.setValueAtTime(baseFreq, now + off);
      osc.frequency.exponentialRampToValueAtTime(95, now + off + 0.055);
      gain.gain.setValueAtTime(0.22 - idx * 0.03, now + off);
      gain.gain.exponentialRampToValueAtTime(0.001, now + off + 0.06);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + off);
      osc.stop(now + off + 0.065);
    });
  }

  public playDiceLand(value: number): void {
    if (this.settings.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(value === 6 ? 520 : 185, now);
    osc.frequency.exponentialRampToValueAtTime(value === 6 ? 780 : 90, now + 0.14);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playTokenHop(stepIndex = 0): void {
    if (this.settings.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const pitch = 390 + (stepIndex % 6) * 32;
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.25, now + 0.06);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playCapture(): void {
    if (this.settings.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // Punchy downward + triumphant chord
    const freqs = [523.25, 659.25, 783.99];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f * 0.75, now + i * 0.03);
      osc.frequency.exponentialRampToValueAtTime(f, now + 0.14 + i * 0.03);
      gain.gain.setValueAtTime(0.18, now + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + i * 0.03);
      osc.stop(now + 0.36);
    });
  }

  public playFinish(): void {
    if (this.settings.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.07);
      gain.gain.setValueAtTime(0.2, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.28);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.3);
    });
  }

  public playTurnNotify(): void {
    if (this.settings.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.setValueAtTime(880, now + 0.07);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playVictory(): void {
    if (this.settings.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5];
    const times = [0, 0.11, 0.22, 0.35, 0.52, 0.66];
    fanfare.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + times[i]);
      gain.gain.setValueAtTime(0.24, now + times[i]);
      gain.gain.exponentialRampToValueAtTime(0.001, now + times[i] + (i === fanfare.length - 1 ? 0.7 : 0.24));
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + times[i]);
      osc.stop(now + times[i] + 0.75);
    });
  }

  public dispose(): void {
    this.stopMusic();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
