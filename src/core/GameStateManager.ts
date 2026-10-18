import { Signal, type Unsubscribe } from './Signal';

export enum GameState {
    MainMenu,
    Playing,
    Paused,
    GameOver
}

export interface IGameStateReader {
    readonly currentState: GameState;
}

export interface IGameStateSource extends IGameStateReader {
    onStateChange(listener: (state: GameState) => void): Unsubscribe;
}

export interface IGameStateController extends IGameStateReader {
    changeState(state: GameState): void;
}

export class GameStateManager implements IGameStateController, IGameStateSource {
    private state = GameState.MainMenu;
    private readonly changed = new Signal<GameState>();

    public get currentState(): GameState {
        return this.state;
    }

    public onStateChange(listener: (state: GameState) => void): Unsubscribe {
        return this.changed.subscribe(listener);
    }

    public changeState(state: GameState): void {
        if (this.state === state) return;
        this.state = state;
        this.changed.emit(state);
    }

    public dispose(): void {
        this.changed.clear();
    }
}
