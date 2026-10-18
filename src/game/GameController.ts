import { GameState, type IGameStateController } from '../core/GameStateManager';

export interface IGameCommands {
    play(): void;
    resume(): void;
    restart(): void;
}

export interface IGameNavigation extends IGameCommands {
    menu(): void;
    togglePause(): void;
}

export class GameController implements IGameNavigation {
    constructor(
        private readonly state: IGameStateController,
        private readonly run: { reset(): void },
        private readonly input: { reset(): void },
        private readonly unlockAudio: () => void
    ) {}

    public play(): void {
        this.input.reset();
        this.run.reset();
        this.unlockAudio();
        this.state.changeState(GameState.Playing);
    }

    public restart(): void {
        this.play();
    }

    public menu(): void {
        this.input.reset();
        this.state.changeState(GameState.MainMenu);
    }

    public resume(): void {
        if (this.state.currentState !== GameState.Paused) return;
        this.input.reset();
        this.unlockAudio();
        this.state.changeState(GameState.Playing);
    }

    public togglePause(): void {
        if (this.state.currentState === GameState.Playing) {
            this.input.reset();
            this.state.changeState(GameState.Paused);
        } else if (this.state.currentState === GameState.Paused) {
            this.resume();
        }
    }
}
