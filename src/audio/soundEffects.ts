import { config } from "../config";
import { createSeededRandom, type RandomSource } from "../game/random";

export class SoundEffects {
  private context: AudioContext | null = null;
  private contextUnavailable = false;
  private muted: boolean;

  constructor(
    private readonly createContext: () => AudioContext = () =>
      new AudioContext(),
    muted: boolean = config.audio.mutedByDefault,
    private readonly random: RandomSource = createSeededRandom(
      config.audio.noiseSeed,
    ),
  ) {
    this.muted = muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  unlock(): void {
    this.getContext();
  }

  playFire(): void {
    const context = this.getContext();
    if (context === null) {
      return;
    }
    this.playTone(
      context,
      config.audio.fireStartFrequency,
      config.audio.fireEndFrequency,
      config.audio.fireDuration,
      config.audio.fireWaveform,
    );
  }

  playBounce(): void {
    const context = this.getContext();
    if (context === null) {
      return;
    }
    this.playTone(
      context,
      config.audio.bounceStartFrequency,
      config.audio.bounceEndFrequency,
      config.audio.bounceDuration,
      config.audio.bounceWaveform,
    );
  }

  playExplosion(): void {
    const context = this.getContext();
    if (context === null) {
      return;
    }
    this.playTone(
      context,
      config.audio.explosionFrequency,
      config.audio.explosionEndFrequency,
      config.audio.explosionDuration,
      config.audio.explosionWaveform,
    );
    this.playNoise(context);
  }

  playRoundWin(): void {
    const context = this.getContext();
    if (context === null) {
      return;
    }
    const noteSpacing =
      config.audio.roundWinNoteDuration + config.audio.roundWinNoteGap;
    config.audio.roundWinFrequencies.forEach((frequency, index) => {
      this.playTone(
        context,
        frequency,
        frequency,
        config.audio.roundWinNoteDuration,
        config.audio.roundWinWaveform,
        index * noteSpacing,
      );
    });
  }

  playPickup(): void {
    const context = this.getContext();
    if (context === null) {
      return;
    }
    this.playTone(
      context,
      config.audio.pickupStartFrequency,
      config.audio.pickupEndFrequency,
      config.audio.pickupDuration,
      config.audio.pickupWaveform,
    );
  }

  private getContext(): AudioContext | null {
    if (this.muted || this.contextUnavailable) {
      return null;
    }
    if (this.context === null) {
      try {
        this.context = this.createContext();
      } catch (error) {
        this.contextUnavailable = true;
        console.error(
          "Unable to initialize Web Audio; continuing without sound.",
          error,
        );
        return null;
      }
    }
    if (this.context.state === "suspended") {
      void this.context.resume().catch((error: unknown) => {
        console.error("Unable to resume Web Audio.", error);
      });
    }
    return this.context;
  }

  private playTone(
    context: AudioContext,
    startFrequency: number,
    endFrequency: number,
    duration: number,
    waveform: OscillatorType,
    delay = 0,
  ): void {
    const startTime = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(startFrequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      endFrequency,
      startTime + duration,
    );
    gain.gain.setValueAtTime(config.audio.minimumGain, startTime);
    gain.gain.exponentialRampToValueAtTime(
      config.audio.masterVolume,
      startTime + Math.min(duration / 4, config.audio.attackDuration),
    );
    gain.gain.exponentialRampToValueAtTime(
      config.audio.minimumGain,
      startTime + duration,
    );
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.01);
  }

  private playNoise(context: AudioContext): void {
    const duration = config.audio.explosionNoiseDuration;
    const frameCount = Math.ceil(context.sampleRate * duration);
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let frame = 0; frame < frameCount; frame += 1) {
      samples[frame] = (this.random() * 2 - 1) * (1 - frame / frameCount);
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const startTime = context.currentTime;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(
      config.audio.explosionNoiseFilterStartFrequency,
      startTime,
    );
    filter.frequency.exponentialRampToValueAtTime(
      config.audio.explosionNoiseFilterEndFrequency,
      startTime + duration,
    );
    gain.gain.setValueAtTime(config.audio.minimumGain, startTime);
    gain.gain.exponentialRampToValueAtTime(
      config.audio.masterVolume * config.audio.explosionNoiseVolume,
      startTime + Math.min(duration / 4, config.audio.attackDuration),
    );
    gain.gain.exponentialRampToValueAtTime(
      config.audio.minimumGain,
      startTime + duration,
    );
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(startTime);
    source.stop(startTime + duration + 0.01);
  }
}

export const soundEffects = new SoundEffects();
