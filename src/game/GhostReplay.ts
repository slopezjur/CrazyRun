import type { IValueStorage } from '../core/StorageService';
import type { PlayerPose } from './PlayerPresentation';
import { MAX_GHOST_FRAMES, type GhostFrame, type GhostRecord, type IGhostPlayback } from './GhostData';

export type { GhostFrame, GhostRecord, IGhostPlayback } from './GhostData';
export interface IGhostRecording {
    start(key: string, pose: Readonly<PlayerPose>): void;
    record(time: number, distance: number, pose: Readonly<PlayerPose>): void;
    finish(score: number, time: number, distance: number, pose: Readonly<PlayerPose>): void;
}

export class GhostRecorder {
    private recording: GhostFrame[] = [];
    private interval = 0.1;
    private nextFrame = 0;

    public get frames(): readonly GhostFrame[] { return this.recording; }

    public start(pose: Readonly<PlayerPose>): void {
        this.recording = [];
        this.interval = 0.1;
        this.nextFrame = 0;
        this.record(0, 0, pose);
    }

    public record(time: number, distance: number, pose: Readonly<PlayerPose>, force = false): void {
        if (!force && time + 1e-6 < this.nextFrame) return;
        if (this.recording.length >= MAX_GHOST_FRAMES - 1) {
            this.recording = this.recording.filter((_, index) => index % 2 === 0);
            this.interval *= 2;
        }
        const rounded = (value: number): number => Math.round(value * 1000) / 1000;
        const frame: GhostFrame = [time, distance, pose.x, pose.y, pose.scaleY, pose.tiltX].map(rounded) as GhostFrame;
        if (this.recording.at(-1)?.[0] === frame[0]) this.recording[this.recording.length - 1] = frame;
        else this.recording.push(frame);
        this.nextFrame = time + this.interval;
    }
}

export class GhostPlayback implements IGhostPlayback {
    private cursor = 0;
    constructor(public readonly record: GhostRecord | null) {}

    public sample(time: number, result: GhostFrame): boolean {
        const frames = this.record?.frames;
        if (!frames?.length || !Number.isFinite(time) || time > frames[frames.length - 1][0]) return false;
        while (this.cursor > 0 && frames[this.cursor][0] > time) this.cursor--;
        while (this.cursor + 1 < frames.length - 1 && frames[this.cursor + 1][0] < time) this.cursor++;
        const first = frames[this.cursor];
        const second = frames[Math.min(this.cursor + 1, frames.length - 1)];
        const fraction = second[0] === first[0] ? 0 : Math.max(0, Math.min(1, (time - first[0]) / (second[0] - first[0])));
        for (let i = 0; i < 6; i++) result[i] = first[i] + (second[i] - first[i]) * fraction;
        return true;
    }
}

export class GhostReplay implements IGhostRecording, IGhostPlayback {
    private records: readonly GhostRecord[];
    private readonly recorder = new GhostRecorder();
    private playback = new GhostPlayback(null);
    private key = '';

    constructor(private readonly storage: IValueStorage<readonly GhostRecord[]>) {
        this.records = storage.load();
    }

    public get best(): GhostRecord | null { return this.playback.record; }

    public start(key: string, pose: Readonly<PlayerPose>): void {
        this.key = key;
        this.playback = new GhostPlayback(this.records.find(record => record.key === key) ?? null);
        this.recorder.start(pose);
    }

    public record(time: number, distance: number, pose: Readonly<PlayerPose>): void {
        this.recorder.record(time, distance, pose);
    }

    public finish(score: number, time: number, distance: number, pose: Readonly<PlayerPose>): void {
        const best = this.records.find(record => record.key === this.key);
        if (score <= (best?.score ?? -1)) return;
        this.recorder.record(time, distance, pose, true);
        if (this.recorder.frames.length < 2) return;
        const record: GhostRecord = {
            key: this.key, score,
            frames: this.recorder.frames.map(frame => [...frame] as GhostFrame)
        };
        this.records = [...this.records.filter(entry => entry.key !== this.key), record].slice(-3);
        this.storage.save(this.records);
    }

    public sample(time: number, result: GhostFrame): boolean { return this.playback.sample(time, result); }
}
