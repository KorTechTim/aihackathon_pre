export type PixelPanicSfx = "button" | "select" | "dialogue" | "dispatch" | "resolve" | "combo" | "wave" | "success" | "failure";

export const BGM_MELODY = [
  76, null, 79, 81, 79, null, 76, 72,
  74, null, 76, 79, 76, null, 72, 69,
  76, null, 79, 83, 81, 79, 76, 74,
  72, 74, 76, 79, 76, 74, 72, null,
] as const;

export const BGM_BASS = [45, 45, 41, 41, 43, 43, 40, 40] as const;
export const BGM_CHORDS = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]] as const;

export function midiToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

const EFFECT_NOTES: Record<PixelPanicSfx, readonly number[]> = {
  button: [76],
  select: [72, 79],
  dialogue: [79, 83, 86],
  dispatch: [60, 67, 72, 76],
  resolve: [67, 72, 76, 79],
  combo: [72, 76, 79, 84, 88],
  wave: [55, 55, 67],
  success: [60, 64, 67, 72, 76],
  failure: [64, 60, 57, 52],
};

type AudioContextConstructor = new () => AudioContext;

export class PixelPanicAudio {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicSources = new Set<AudioScheduledSourceNode>();
  private nextStepTime = 0;
  private musicStep = 0;
  private enabled = true;
  private musicRequested = false;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopMusic(true);
      if (this.context?.state === "running") void this.context.suspend();
      return;
    }
    if (this.context) void this.context.resume();
    if (this.musicRequested) void this.startMusic();
  }

  async startMusic(): Promise<void> {
    this.musicRequested = true;
    if (!this.enabled || this.musicTimer !== null) return;
    let context: AudioContext;
    try {
      context = this.ensureContext();
      await context.resume();
    } catch {
      return;
    }
    if (!this.enabled || !this.musicRequested || this.musicTimer !== null) return;
    this.musicStep = 0;
    this.nextStepTime = context.currentTime + 0.06;
    this.scheduleMusic();
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 50);
  }

  stopMusic(preserveIntent = false): void {
    if (!preserveIntent) this.musicRequested = false;
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    for (const source of this.musicSources) {
      try { source.stop(); } catch { /* source already ended */ }
    }
    this.musicSources.clear();
  }

  play(effect: PixelPanicSfx): void {
    if (!this.enabled) return;
    let context: AudioContext;
    try {
      context = this.ensureContext();
    } catch {
      return;
    }
    void context.resume();
    const start = context.currentTime + 0.012;
    const notes = EFFECT_NOTES[effect];
    const step = effect === "combo" || effect === "success" ? 0.075 : 0.09;
    const descending = effect === "failure";
    notes.forEach((note, index) => {
      const duration = effect === "wave" ? 0.16 : descending ? 0.22 : 0.12;
      this.tone(note, start + index * step, duration, effect === "failure" ? "sawtooth" : "square", effect === "button" ? 0.11 : 0.16, false);
    });
    if (effect === "dispatch") this.sweep(start, 145, 430, 0.34, 0.13);
    if (effect === "resolve") this.sweep(start, 260, 760, 0.24, 0.1);
    if (effect === "combo" || effect === "success") this.chord(notes.slice(-3), start + notes.length * step, 0.42, 0.12);
    if (effect === "wave") this.sweep(start, 95, 48, 0.5, 0.18);
    if (effect === "failure") this.sweep(start, 120, 38, 0.8, 0.15);
  }

  getDebugState(): { enabled: boolean; musicRequested: boolean; musicPlaying: boolean; contextState: AudioContextState | "uninitialized" } {
    return {
      enabled: this.enabled,
      musicRequested: this.musicRequested,
      musicPlaying: this.musicTimer !== null,
      contextState: this.context?.state ?? "uninitialized",
    };
  }

  dispose(): void {
    this.stopMusic();
    if (this.context && this.context.state !== "closed") void this.context.close();
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
  }

  private ensureContext(): AudioContext {
    if (this.context) return this.context;
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!AudioContextClass) throw new Error("이 브라우저는 Web Audio를 지원하지 않습니다.");
    const context = new AudioContextClass();
    const master = context.createGain();
    const music = context.createGain();
    const sfx = context.createGain();
    master.gain.value = 0.72;
    music.gain.value = 0.16;
    sfx.gain.value = 0.5;
    music.connect(master);
    sfx.connect(master);
    master.connect(context.destination);
    this.context = context;
    this.masterGain = master;
    this.musicGain = music;
    this.sfxGain = sfx;
    return context;
  }

  private scheduleMusic(): void {
    const context = this.context;
    if (!context || !this.musicGain || !this.enabled) return;
    const stepDuration = 60 / 112 / 4;
    while (this.nextStepTime < context.currentTime + 0.28) {
      const step = this.musicStep % BGM_MELODY.length;
      const melody = BGM_MELODY[step];
      if (melody !== null) this.tone(melody, this.nextStepTime, stepDuration * 0.78, "square", 0.2, true);
      if (step % 4 === 0) {
        const bass = BGM_BASS[Math.floor(step / 4) % BGM_BASS.length];
        this.tone(bass, this.nextStepTime, stepDuration * 3.35, "triangle", 0.28, true);
      }
      if (step % 2 === 0) {
        const chord = BGM_CHORDS[Math.floor(step / 8) % BGM_CHORDS.length];
        const arpNote = chord[Math.floor(step / 2) % chord.length] + 12;
        this.tone(arpNote, this.nextStepTime, stepDuration * 0.42, "square", 0.08, true);
      }
      if (step % 8 === 0) this.sweep(this.nextStepTime, 110, 46, 0.11, 0.2, true);
      if (step % 4 === 2) this.tone(102, this.nextStepTime, 0.025, "square", 0.035, true);
      this.nextStepTime += stepDuration;
      this.musicStep = (this.musicStep + 1) % BGM_MELODY.length;
    }
  }

  private chord(notes: readonly number[], start: number, duration: number, volume: number): void {
    notes.forEach((note) => this.tone(note, start, duration, "square", volume, false));
  }

  private tone(note: number, start: number, duration: number, type: OscillatorType, volume: number, music: boolean): void {
    const context = this.context;
    const destination = music ? this.musicGain : this.sfxGain;
    if (!context || !destination) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(midiToFrequency(note), start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    if (music) this.trackMusicSource(oscillator);
  }

  private sweep(start: number, from: number, to: number, duration: number, volume: number, music = false): void {
    const context = this.context;
    const destination = music ? this.musicGain : this.sfxGain;
    if (!context || !destination) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    envelope.gain.setValueAtTime(Math.max(0.0001, volume), start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    if (music) this.trackMusicSource(oscillator);
  }

  private trackMusicSource(source: AudioScheduledSourceNode): void {
    this.musicSources.add(source);
    source.addEventListener("ended", () => this.musicSources.delete(source), { once: true });
  }
}
