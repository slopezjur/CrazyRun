export interface IScoreStorage {
    saveHighScore(score: number): void;
    loadHighScore(): number;
}

export class BrowserStorage implements IScoreStorage {
    private readonly key = 'crazyrun_highscore';

    public saveHighScore(score: number): void {
        localStorage.setItem(this.key, score.toString());
    }

    public loadHighScore(): number {
        const saved = localStorage.getItem(this.key);
        return saved ? parseInt(saved, 10) : 0;
    }
}
