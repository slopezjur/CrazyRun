import type { CollisionResponse } from './CollisionManager';
import type { IGameplayOutcomes } from './GameScene';
import type { IRunRewardsPolicy, PowerUp } from './RunSession';
import type { IScoreTracker } from './ScoreTracker';
import type { SpawnData } from './SpawnPolicy';

export interface IHitTarget {
    readonly position: Readonly<{ x: number; y: number; z: number }>;
    despawn(): void;
}
export interface ICoinPickup {
    readonly position: Readonly<{ x: number; y: number; z: number }>;
    readonly spawnData: SpawnData;
}

export class RunOutcomes {
    constructor(
        private readonly run: IRunRewardsPolicy,
        private readonly game: IGameplayOutcomes,
        private readonly score: Pick<IScoreTracker, 'addBonus'>
    ) {}

    public hit(target: IHitTarget): CollisionResponse {
        if (!this.game.isPlaying) return 'stop';
        const { x, y, z } = target.position;
        if (this.run.absorbHit([x, y, z])) {
            target.despawn();
            return 'continue';
        }
        this.game.crash();
        return 'stop';
    }

    public clear(arch: boolean, near: boolean): void {
        if (this.game.isPlaying) this.score.addBonus(this.run.clearObstacle(arch, near));
    }

    public coin(coin: ICoinPickup): void {
        if (!this.game.isPlaying) return;
        const { x, y, z } = coin.position;
        this.game.collect(this.run.collectCoin(coin.spawnData.chainId, coin.spawnData.chainSize ?? 1, [x, y, z]));
    }

    public miss(coin: Pick<ICoinPickup, 'spawnData'>): void { this.run.missChain(coin.spawnData.chainId); }
    public power(power: PowerUp): void { if (this.game.isPlaying) this.run.pickUp(power); }
}
