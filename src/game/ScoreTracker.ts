import type { IValueStorage } from '../core/StorageService';
import { Signal, type Unsubscribe } from '../core/Signal';

export interface IScoreSource {
    readonly score: number;
    readonly highestScore: number;
}

export interface IScoreTracker {
    reset(): void;
    addBonus(points: number): void;
    update(speed: number, delta: number): void;
    finalizeScore(): void;
}

export class ScoreTracker implements IScoreTracker, IScoreSource {
    private currentScore = 0;
    private highScore: number;
    private readonly changed = new Signal<number>();

    constructor(private readonly storage: IValueStorage<number>) {
        const saved = storage.load();
        this.highScore = Number.isSafeInteger(saved) && saved >= 0 ? saved : 0;
    }

    public get score(): number {
        return Math.floor(this.currentScore);
    }

    public get highestScore(): number {
        return this.highScore;
    }

    public onScoreUpdated(listener: (score: number) => void): Unsubscribe {
        return this.changed.subscribe(listener);
    }

    public reset(): void {
        this.currentScore = 0;
        this.changed.emit(this.score);
    }

    public addBonus(points: number): void {
        this.add(points);
    }

    public update(speed: number, delta: number): void {
        this.add(speed * delta);
    }

    /** Publishes only visible (integer) score changes, not every fixed tick. */
    private add(points: number): void {
        const previous = this.score;
        this.currentScore += points;
        if (this.score !== previous) this.changed.emit(this.score);
    }

    public finalizeScore(): void {
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.storage.save(this.highScore);
        }
    }

    public dispose(): void {
        this.changed.clear();
    }
}
