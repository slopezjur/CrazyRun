import { IScoreStorage } from '../core/StorageService';

export class ScoreTracker {
    private currentScore: number = 0;
    private highScore: number = 0;
    
    // Decoupled DOM updates via event callback
    public onScoreUpdated?: (score: number) => void;

    constructor(private storage: IScoreStorage) {
        this.highScore = this.storage.loadHighScore();
    }

    public get score(): number {
        return Math.floor(this.currentScore);
    }

    public get highestScore(): number {
        return this.highScore;
    }

    public reset(): void {
        this.currentScore = 0;
        this.notify();
    }

    public addBonus(points: number): void {
        this.currentScore += points;
        this.notify();
    }

    public update(speed: number, deltaTime: number): void {
        this.currentScore += speed * deltaTime;
        this.notify();
    }

    public finalizeScore(): void {
        if (this.currentScore > this.highScore) {
            this.highScore = Math.floor(this.currentScore);
            this.storage.saveHighScore(this.highScore);
        }
    }

    private notify(): void {
        if (this.onScoreUpdated) {
            this.onScoreUpdated(this.score);
        }
    }
}
