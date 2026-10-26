import { GameState, type IGameStateReader } from '../core/GameStateManager';
import { Signal, type Unsubscribe } from '../core/Signal';
import type { ISoundPlayer } from './AudioManager';
import type { IChunkManager } from './ChunkManager';
import type { IEntityManager } from './EntityManager';
import type { IPlayer } from './Player';
import type { IScoreTracker } from './ScoreTracker';
import type { IRunSimulation } from './RunSession';
import type { IRunInteractions } from './RunInteractions';

export interface GameSceneDependencies {
    readonly state: IGameStateReader;
    readonly player: IPlayer;
    readonly chunks: IChunkManager;
    readonly entities: IEntityManager;
    readonly collisions: { checkCollisions(): void };
    readonly camera: { update(delta: number, speed: number): void; reset(): void; triggerShake(intensity: number): void };
    readonly score: IScoreTracker;
    readonly audio: ISoundPlayer;
    readonly input: { resetTriggers(): void };
    readonly run: IRunSimulation;
    readonly interactions?: IRunInteractions;
    readonly initialEmptyChunks?: number;
}

export interface IGameplayOutcomes {
    readonly isPlaying: boolean;
    crash(): void;
    collect(points: number): void;
}
export interface IGameRuntime {
    readonly isPlaying: boolean;
    readonly globalSpeed: number;
    reset(): void;
    fixedUpdate(delta: number): void;
    update(delta: number): void;
    onGameOver(listener: () => void): Unsubscribe;
}

export class GameScene implements IGameplayOutcomes, IGameRuntime {
    private speed = 30;
    private readonly baseSpeed = 30;
    private readonly gameOver = new Signal<void>();
    private readonly subscriptions: Unsubscribe[];

    constructor(private readonly dependencies: GameSceneDependencies) {
        this.subscriptions = [
            dependencies.player.onAction(action => {
                if (this.isPlaying) dependencies.audio.play(action);
            }),
            dependencies.chunks.onChunkRecycled(z => {
                if (this.isPlaying) dependencies.entities.spawnOnChunk(z);
            })
        ];
    }

    public get isPlaying(): boolean {
        return this.dependencies.state.currentState === GameState.Playing;
    }

    public get globalSpeed(): number {
        return this.speed;
    }

    public onGameOver(listener: () => void): Unsubscribe {
        return this.gameOver.subscribe(listener);
    }

    public crash(): void {
        if (!this.isPlaying || this.speed === 0) return;
        this.speed = 0;
        this.dependencies.camera.triggerShake(2);
        this.dependencies.audio.play('crash');
        this.dependencies.score.finalizeScore();
        this.gameOver.emit(undefined);
    }

    public collect(points: number): void {
        if (!this.isPlaying || this.speed === 0) return;
        this.dependencies.score.addBonus(points);
        this.dependencies.audio.play('coin', 1 + Math.min(12, this.dependencies.run.combo) / 24);
    }

    public fixedUpdate(delta: number): void {
        const { state, player, score, collisions, chunks, input, entities, run, interactions } = this.dependencies;
        if (state.currentState === GameState.Paused) return;
        if (this.isPlaying && this.speed > 0) {
            this.speed = run.speed;
            const simulationDelta = delta * run.timeScale;
            const amount = this.speed * simulationDelta;
            player.fixedUpdate(simulationDelta, this.speed, true);
            run.advance(delta, amount);
            score.update(this.speed * run.multiplier, simulationDelta);
            entities.update(simulationDelta);
            interactions?.prepare(simulationDelta);
            // Substeps keep thin hurdles and coins detectable at maximum speed.
            const steps = Math.max(1, Math.ceil(amount / 0.45));
            for (let step = 0; step < steps && this.isPlaying && this.speed > 0; step++) {
                chunks.scroll(amount / steps);
                entities.scroll(amount / steps);
                collisions.checkCollisions();
                if (this.isPlaying) interactions?.observe();
            }
            chunks.updatePooling(0);
        } else {
            player.fixedUpdate(delta, this.speed, false);
        }
        input.resetTriggers();
    }

    public update(delta: number): void {
        const { state, camera, player, run } = this.dependencies;
        if (state.currentState === GameState.Paused) return;
        camera.update(delta, this.speed);
        player.update(delta * run.timeScale);
    }

    private readonly spawnInitial = (z: number, index: number): void => {
        if (index >= (this.dependencies.initialEmptyChunks ?? 5)) this.dependencies.entities.spawnOnChunk(z);
    };

    public reset(): void {
        const { score, chunks, entities, camera, player } = this.dependencies;
        this.speed = this.baseSpeed;
        this.dependencies.run.reset();
        score.reset();
        chunks.reset();
        entities.reset();
        // The camera rests relative to the reset player pose.
        player.reset();
        camera.reset();
        chunks.forEachPosition(this.spawnInitial);
    }

    public dispose(): void {
        for (const unsubscribe of this.subscriptions) unsubscribe();
        this.gameOver.clear();
    }
}
