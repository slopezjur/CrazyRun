import { GameStateManager, GameState } from '../core/GameStateManager';

export interface IGameHooks {
    onPlay: () => void;
    onResume: () => void;
    onRestart: () => void;
}

export class UIManager {
    private panels: Map<string, HTMLElement | null> = new Map();
    private scoreDisplay: HTMLElement | null;
    private finalScoreDisplay: HTMLElement | null;
    private highScoreDisplay: HTMLElement | null;

    constructor(private stateManager: GameStateManager, private hooks: IGameHooks) {
        this.panels.set('panel-main-menu', document.getElementById('panel-main-menu'));
        this.panels.set('panel-hud', document.getElementById('panel-hud'));
        this.panels.set('panel-paused', document.getElementById('panel-paused'));
        this.panels.set('panel-game-over', document.getElementById('panel-game-over'));

        this.scoreDisplay = document.getElementById('score-display');
        this.finalScoreDisplay = document.getElementById('final-score-display');
        this.highScoreDisplay = document.getElementById('high-score-display');

        this.bindEvents();
        this.syncWithState(this.stateManager.currentState);
    }

    public updateLiveScore(score: number): void {
        if (this.scoreDisplay) this.scoreDisplay.innerText = score.toString();
    }

    public updateFinalScores(score: number, highScore: number): void {
        if (this.finalScoreDisplay) this.finalScoreDisplay.innerText = score.toString();
        if (this.highScoreDisplay) this.highScoreDisplay.innerText = highScore.toString();
    }

    private bindEvents(): void {
        const btnPlay = document.getElementById('btn-play');
        const btnResume = document.getElementById('btn-resume');
        const btnRestart = document.getElementById('btn-restart');

        btnPlay?.addEventListener('click', () => this.hooks.onPlay());
        btnResume?.addEventListener('click', () => this.hooks.onResume());
        btnRestart?.addEventListener('click', () => this.hooks.onRestart());

        this.stateManager.onStateChange((newState) => {
            this.syncWithState(newState);
        });
    }

    private syncWithState(state: GameState): void {
        switch (state) {
            case GameState.MainMenu:
                this.showPanel('panel-main-menu');
                break;
            case GameState.Playing:
                this.showPanel('panel-hud');
                break;
            case GameState.Paused:
                this.showPanel('panel-paused');
                break;
            case GameState.GameOver:
                this.showPanel('panel-game-over');
                break;
        }
    }

    private showPanel(id: string): void {
        // Hide all
        for (const [panelId, element] of this.panels.entries()) {
            if (element && panelId !== id) {
                element.classList.add('hidden');
                element.classList.remove('active');
            }
        }
        
        // Show target
        const target = this.panels.get(id);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('active');
        }
    }
}
