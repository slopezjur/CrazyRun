import type { ISoundPlayer } from '../AudioManager';
import type { IRunState } from '../RunSession';

export class AdaptiveMusic {
    private timer = 0;
    private beat = 0;
    constructor(private readonly audio: ISoundPlayer) {}

    public reset(): void { this.timer = this.beat = 0; }

    public update(delta: number, run: Pick<IRunState, 'crazyRemaining' | 'spectacle' | 'combo'>): void {
        this.timer -= delta;
        if (this.timer > 0) return;
        const intense = run.crazyRemaining > 0 || run.spectacle === 'active';
        this.timer += 60 / (intense ? 150 : 100 + Math.min(30, run.combo));
        const melody = [1, 1.25, 1.5, 1.25, 1, 1.125, 1.5, 2];
        this.audio.play('bass', this.beat % 4 < 2 ? 1 : 0.75);
        if (run.combo >= 5 || intense) this.audio.play('melody', melody[this.beat % melody.length]);
        this.beat++;
    }
}
