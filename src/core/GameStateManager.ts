export enum GameState {
    MainMenu,
    Playing,
    Paused,
    GameOver
}

export class GameStateManager {
    public currentState: GameState = GameState.MainMenu;
    public logicalUpdatesPerSecond: number = 0;
    private debugElement: HTMLElement | null;

    private listeners: ((state: GameState) => void)[] = [];

    constructor() {
        this.debugElement = document.getElementById('debug-overlay');
        this.updateDebugUI();
    }

    public onStateChange(listener: (state: GameState) => void): void {
        this.listeners.push(listener);
    }

    public changeState(newState: GameState): void {
        if (this.currentState === newState) return;
        this.currentState = newState;
        this.updateDebugUI();
        for (const listener of this.listeners) {
            listener(this.currentState);
        }
    }

    public updateDebugUI(): void {
        if (this.debugElement) {
            this.debugElement.innerHTML = `State: ${GameState[this.currentState]}<br>UPS: ${this.logicalUpdatesPerSecond}`;
        }
    }
}
