import { GameState, type IGameStateController, type IGameStateSource } from '../core/GameStateManager';
import type { Unsubscribe } from '../core/Signal';
import type { Biome, Challenge } from '../game/Challenge';
import type { IGameNavigation } from '../game/GameController';
import type { IGameRuntime } from '../game/GameScene';
import type { IGhostRecording } from '../game/GhostReplay';
import type { IGhostPlayback } from '../game/GhostData';
import type { PlayerPose } from '../game/PlayerPresentation';
import type { IAppearanceSource, IRunRewards, RunRewards } from '../game/Progression';
import type { IRunState } from '../game/RunSession';
import type { IScoreSource } from '../game/ScoreTracker';

export interface RunCoordinatorDependencies {
    readonly game: IGameRuntime;
    readonly commands: IGameNavigation;
    readonly state: IGameStateSource & IGameStateController;
    readonly input: { reset(): void };
    readonly run: IRunState & { selectChallenge(challenge: Challenge): void };
    readonly player: { readonly currentPose: Readonly<PlayerPose> };
    readonly profile: IAppearanceSource & IRunRewards;
    readonly replay: IGhostRecording & IGhostPlayback;
    readonly score: IScoreSource;
    readonly scoreUI: { updateFinalScores(score: number, highest: number): void };
    readonly runUI: { start(): void; showResults(rewards: RunRewards): void; update(delta: number, distance: number | null): void };
    readonly music: { reset(): void; update(delta: number, run: IRunState): void };
    readonly world: { update(delta: number, distance: number, biome: Biome, spectacle: string, motion: number): void };
    readonly effects: {
        readonly ghostDistance: number | null;
        reset(): void;
        update(delta: number, speed: number, pose: Readonly<PlayerPose>, run: IRunState,
            profile: IAppearanceSource, replay: IGhostPlayback, playing: boolean): void;
    };
    readonly freeChallenge: () => Challenge;
    readonly dailyChallenge: () => Challenge;
}

export class RunCoordinator {
    private readonly subscriptions: Unsubscribe[];
    private settled = false;

    constructor(private readonly dependencies: RunCoordinatorDependencies) {
        this.subscriptions = [
            dependencies.game.onGameOver(() => this.finish()),
            dependencies.state.onStateChange(phase => {
                if (phase === GameState.MainMenu) dependencies.effects.reset();
            })
        ];
    }

    public playFree(): void {
        this.dependencies.run.selectChallenge(this.dependencies.freeChallenge());
        this.dependencies.commands.play();
    }

    public playDaily(): void {
        this.dependencies.run.selectChallenge(this.dependencies.dailyChallenge());
        this.dependencies.commands.play();
    }

    public menu(): void {
        this.dependencies.commands.menu();
        this.dependencies.game.reset();
    }

    public reset(): void {
        const { game, replay, run, player, effects, music, runUI } = this.dependencies;
        this.settled = false;
        game.reset();
        replay.start(run.challenge.key, player.currentPose);
        effects.reset();
        music.reset();
        runUI.start();
    }

    private finish(): void {
        const { game, input, profile, run, score, replay, player, runUI, scoreUI, state } = this.dependencies;
        if (this.settled || !game.isPlaying) return;
        this.settled = true;
        input.reset();
        const rewards = profile.finish(run.stats, score.score, run.challenge.key);
        replay.finish(score.score, run.elapsed, run.stats.distance, player.currentPose);
        runUI.showResults(rewards);
        scoreUI.updateFinalScores(score.score, score.highestScore);
        state.changeState(GameState.GameOver);
    }

    public readonly fixedUpdate = (delta: number): void => {
        const { game, replay, run, player, music } = this.dependencies;
        game.fixedUpdate(delta);
        if (game.isPlaying) {
            replay.record(run.elapsed, run.stats.distance, player.currentPose);
            music.update(delta, run);
        }
    };

    public readonly update = (delta: number): void => {
        const { game, world, run, profile, effects, player, replay, runUI } = this.dependencies;
        game.update(delta);
        world.update(delta, run.stats.distance, run.biome, game.isPlaying ? run.spectacle : 'none', profile.motion);
        effects.update(delta, game.isPlaying ? game.globalSpeed * run.timeScale : 0,
            player.currentPose, run, profile, replay, game.isPlaying);
        runUI.update(delta, effects.ghostDistance);
    };

    public dispose(): void { for (const unsubscribe of this.subscriptions) unsubscribe(); }
}
