import type { Box3 } from 'three';
import type { IPlayerState } from './Player';
import type { IRunState } from './RunSession';

export interface IRunInteractions {
    prepare(delta: number): void;
    observe(): void;
}
export interface IInteractiveHazard {
    readonly isActive: boolean;
    readonly z: number;
    simulate(time: number): void;
    observe(box: Box3, x: number, sliding: boolean): void;
}
export interface IAttractable {
    readonly isActive: boolean;
    readonly z: number;
    attractTo(x: number, y: number, fraction: number): void;
}

export class RunInteractions implements IRunInteractions {
    constructor(
        private readonly run: Pick<IRunState, 'elapsed' | 'magnetRemaining' | 'crazyRemaining'>,
        private readonly player: Pick<IPlayerState, 'currentPose' | 'boundingBox' | 'isSliding'>,
        private readonly hazards: readonly IInteractiveHazard[],
        private readonly coins: readonly IAttractable[]
    ) {}

    public prepare(delta: number): void {
        for (const hazard of this.hazards) {
            if (hazard.isActive && hazard.z > -200) hazard.simulate(this.run.elapsed);
        }
        if (this.run.magnetRemaining <= 0 && this.run.crazyRemaining <= 0) return;
        const pose = this.player.currentPose;
        const attraction = Math.min(1, delta * 16);
        for (const coin of this.coins) {
            if (coin.isActive && coin.z >= -14 && coin.z <= 1) coin.attractTo(pose.x, pose.y, attraction);
        }
    }

    public observe(): void {
        for (const hazard of this.hazards) {
            if (hazard.isActive && hazard.z > -3) {
                hazard.observe(this.player.boundingBox, this.player.currentPose.x, this.player.isSliding);
            }
        }
    }
}
