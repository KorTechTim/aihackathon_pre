export type PixelPanicSfx = "button" | "select" | "dialogue" | "dispatch" | "resolve" | "combo" | "wave" | "success" | "failure";
export type PixelPanicMusicTrack = "title" | "mission" | "stage-complete";

export const TITLE_BGM_MELODY = [
  72, null, 76, 79, 81, null, 79, 76,
  74, null, 77, 81, 79, null, 76, 72,
  67, 72, 74, 76, 79, 76, 74, null,
  72, null, 76, 79, 83, 81, 79, null,
] as const;

export const TITLE_BGM_BASS = [48, 48, 45, 45, 41, 43, 45, 47] as const;
export const TITLE_BGM_CHORDS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]] as const;

export const BGM_MELODY = [
  76, null, 79, 81, 79, null, 76, 72,
  74, null, 76, 79, 76, null, 72, 69,
  76, null, 79, 83, 81, 79, 76, 74,
  72, 74, 76, 79, 76, 74, 72, null,
] as const;

export const BGM_BASS = [45, 45, 41, 41, 43, 43, 40, 40] as const;
export const BGM_CHORDS = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]] as const;

export const STAGE_COMPLETE_BGM_MELODY = [
  79, 81, 83, 86, 84, 83, 81, 79,
  76, 79, 81, 84, 83, 81, 79, null,
  84, 86, 88, 91, 88, 86, 84, 81,
  79, 81, 83, 86, 88, 86, 84, null,
] as const;

export const STAGE_COMPLETE_BGM_BASS = [48, 48, 53, 53, 55, 55, 60, 55] as const;
export const STAGE_COMPLETE_BGM_CHORDS = [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]] as const;

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
  private requestedTrack: PixelPanicMusicTrack | null = null;
  private activeTrack: PixelPanicMusicTrack | null = null;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopMusic(true);
      if (this.context?.state === "running") void this.context.suspend();
      return;
    }
    if (this.context) void this.context.resume();
    if (this.requestedTrack) void this.startMusic(this.requestedTrack);
  }

  startTitleMusic(): Promise<void> {
    return this.startMusic("title");
  }

  startStageCompleteMusic(): Promise<void> {
    return this.startMusic("stage-complete");
  }

  async startMusic(track: PixelPanicMusicTrack = "mission"): Promise<void> {
    this.requestedTrack = track;
    if (!this.enabled || this.musicTimer !== null && this.activeTrack === track) return;
    if (this.musicTimer !== null) this.stopMusic(true);
    let context: AudioContext;
    try {
      context = this.ensureContext();
      await context.resume();
    } catch {
      return;
    }
    if (!this.enabled || this.requestedTrack !== track || this.musicTimer !== null) return;
    this.activeTrack = track;
    this.musicStep = 0;
    this.nextStepTime = context.currentTime + 0.06;
    this.scheduleMusic();
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 50);
  }

  stopMusic(preserveIntent = false): void {
    if (!preserveIntent) this.requestedTrack = null;
    this.activeTrack = null;
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

  getDebugState(): { enabled: boolean; requestedTrack: PixelPanicMusicTrack | null; activeTrack: PixelPanicMusicTrack | null; musicPlaying: boolean; contextState: AudioContextState | "uninitialized" } {
    return {
      enabled: this.enabled,
      requestedTrack: this.requestedTrack,
      activeTrack: this.activeTrack,
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
    const track = this.activeTrack;
    if (!context || !this.musicGain || !this.enabled || !track) return;
    const title = track === "title";
    const stageComplete = track === "stage-complete";
    const melodyPattern = title ? TITLE_BGM_MELODY : stageComplete ? STAGE_COMPLETE_BGM_MELODY : BGM_MELODY;
    const bassPattern = title ? TITLE_BGM_BASS : stageComplete ? STAGE_COMPLETE_BGM_BASS : BGM_BASS;
    const chordPattern = title ? TITLE_BGM_CHORDS : stageComplete ? STAGE_COMPLETE_BGM_CHORDS : BGM_CHORDS;
    const stepDuration = 60 / (title ? 96 : stageComplete ? 128 : 112) / 4;
    while (this.nextStepTime < context.currentTime + 0.28) {
      const step = this.musicStep % melodyPattern.length;
      const melody = melodyPattern[step];
      if (melody !== null) this.tone(melody, this.nextStepTime, stepDuration * (title ? 0.86 : stageComplete ? 0.68 : 0.78), "square", title ? 0.15 : stageComplete ? 0.18 : 0.2, true);
      if (step % 4 === 0) {
        const bass = bassPattern[Math.floor(step / 4) % bassPattern.length];
        this.tone(bass, this.nextStepTime, stepDuration * (stageComplete ? 2.8 : 3.35), "triangle", title ? 0.2 : stageComplete ? 0.23 : 0.28, true);
      }
      if (step % 2 === 0) {
        const chord = chordPattern[Math.floor(step / 8) % chordPattern.length];
        const arpNote = chord[Math.floor(step / 2) % chord.length] + 12;
        this.tone(arpNote, this.nextStepTime, stepDuration * (stageComplete ? 0.32 : 0.42), "square", title ? 0.055 : stageComplete ? 0.075 : 0.08, true);
      }
      if (step % 8 === 0) this.sweep(this.nextStepTime, title ? 92 : stageComplete ? 138 : 110, title ? 55 : stageComplete ? 74 : 46, 0.11, title ? 0.1 : stageComplete ? 0.13 : 0.2, true);
      if (!title && step % 4 === 2) this.tone(102, this.nextStepTime, 0.025, "square", 0.035, true);
      if (stageComplete && step % 8 === 6) this.tone(95, this.nextStepTime, stepDuration * 0.5, "square", 0.06, true);
      this.nextStepTime += stepDuration;
      this.musicStep = (this.musicStep + 1) % melodyPattern.length;
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
