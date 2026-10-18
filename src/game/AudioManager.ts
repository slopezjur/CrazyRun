import type { IValueStorage } from '../core/StorageService';

export interface SoundDefinition {
    readonly waveform: OscillatorType;
    readonly startFrequency: number;
    readonly endFrequency: number;
    readonly frequencyEnd: number;
    readonly frequencyMode: 'step' | 'exponential';
    readonly volume: number;
    readonly fadeStart: number;
    readonly fadeEnd: number;
    readonly duration: number;
}

export interface ISoundPlayer {
    play(id: string, pitch?: number): void;
}

export interface IAudioControl {
    readonly isMuted: boolean;
    toggleMute(): boolean;
}

interface Voice {
    readonly oscillator: OscillatorNode;
    readonly gain: GainNode;
}

export class AudioManager implements ISoundPlayer, IAudioControl {
    private readonly masterGain: GainNode;
    private readonly voices = new Set<Voice>();
    private muted: boolean;
    private disposed = false;

    constructor(
        private readonly context: AudioContext,
        private readonly preference: IValueStorage<boolean>,
        private readonly sounds: ReadonlyMap<string, SoundDefinition>
    ) {
        this.masterGain = context.createGain();
        this.masterGain.connect(context.destination);
        this.muted = preference.load();
        this.applyVolume();
    }

    public get isMuted(): boolean {
        return this.muted;
    }

    public toggleMute(): boolean {
        this.muted = !this.muted;
        this.preference.save(this.muted);
        this.applyVolume();
        return this.muted;
    }

    private applyVolume(): void {
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : 1, this.context.currentTime);
    }

    public unlock(): void {
        if (!this.disposed && this.context.state === 'suspended') {
            void this.context.resume().catch(() => {});
        }
    }

    public play(id: string, pitch = 1): void {
        if (this.disposed || this.muted) return;
        const sound = this.sounds.get(id);
        if (!sound) throw new Error('Unknown sound: ' + id);
        this.unlock();
        const now = this.context.currentTime;
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = sound.waveform;
        const rate = Number.isFinite(pitch) ? Math.max(0.25, Math.min(4, pitch)) : 1;
        oscillator.frequency.setValueAtTime(sound.startFrequency * rate, now);
        if (sound.frequencyMode === 'step') {
            oscillator.frequency.setValueAtTime(sound.endFrequency * rate, now + sound.frequencyEnd);
        } else {
            oscillator.frequency.exponentialRampToValueAtTime(sound.endFrequency * rate, now + sound.frequencyEnd);
        }
        gain.gain.setValueAtTime(sound.volume, now);
        gain.gain.setValueAtTime(sound.volume, now + sound.fadeStart);
        gain.gain.exponentialRampToValueAtTime(0.001, now + sound.fadeEnd);
        oscillator.connect(gain);
        gain.connect(this.masterGain);
        const voice: Voice = { oscillator, gain };
        this.voices.add(voice);
        oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
            this.voices.delete(voice);
        };
        oscillator.start(now);
        oscillator.stop(now + sound.duration);
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        for (const voice of this.voices) {
            voice.oscillator.onended = null;
            voice.oscillator.stop();
            voice.oscillator.disconnect();
            voice.gain.disconnect();
        }
        this.voices.clear();
        this.masterGain.disconnect();
    }
}
