import type { IGameStateReader } from '../core/GameStateManager';
import { GameState } from '../core/GameStateManager';

export class BrowserGameEvents {
    private readonly events = new AbortController();
    constructor(document: Document, viewport: Window, state: IGameStateReader, pause: () => void) {
        const pauseOnFocusLoss = (): void => { if (state.currentState === GameState.Playing) pause(); };
        viewport.addEventListener('blur', pauseOnFocusLoss, { signal: this.events.signal });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) pauseOnFocusLoss();
        }, { signal: this.events.signal });
    }
    public dispose(): void { this.events.abort(); }
}
