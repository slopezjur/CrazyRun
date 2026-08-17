import { GameStateManager, GameState } from '../core/GameStateManager';
import { I18nService, Translations, Language } from '../core/I18nService';

export interface IGameHooks {
    onPlay: () => void;
    onResume: () => void;
    onRestart: () => void;
    onToggleAudio?: () => boolean;
    isAudioMuted?: () => boolean;
}

export class UIManager {
    private panels: Map<string, HTMLElement | null> = new Map();
    private scoreDisplay: HTMLElement | null;
    private finalScoreDisplay: HTMLElement | null;
    private highScoreDisplay: HTMLElement | null;
    private btnLang: HTMLElement | null;
    private btnAudio: HTMLElement | null;
    public i18n: I18nService;

    constructor(private stateManager: GameStateManager, private hooks: IGameHooks) {
        this.panels.set('panel-main-menu', document.getElementById('panel-main-menu'));
        this.panels.set('panel-hud', document.getElementById('panel-hud'));
        this.panels.set('panel-paused', document.getElementById('panel-paused'));
        this.panels.set('panel-game-over', document.getElementById('panel-game-over'));

        this.scoreDisplay = document.getElementById('score-display');
        this.finalScoreDisplay = document.getElementById('final-score-display');
        this.highScoreDisplay = document.getElementById('high-score-display');
        this.btnLang = document.getElementById('btn-lang');
        this.btnAudio = document.getElementById('btn-audio');

        this.i18n = new I18nService();
        this.i18n.onChange((lang, t) => this.applyTranslations(lang, t));

        this.updateAudioButtonState();
        this.bindEvents();
        this.syncWithState(this.stateManager.currentState);
    }

    private updateAudioButtonState(): void {
        if (this.btnAudio && this.hooks.isAudioMuted) {
            const muted = this.hooks.isAudioMuted();
            this.btnAudio.innerText = muted ? '🔇' : '🔊';
        }
    }

    private applyTranslations(lang: Language, t: Translations): void {
        if (this.btnLang) {
            this.btnLang.innerText = lang === 'es' ? '🌐 Español' : '🌐 English';
        }

        const elements = document.querySelectorAll<HTMLElement>('[data-i18n]');
        elements.forEach((el) => {
            const key = el.getAttribute('data-i18n') as keyof Translations;
            if (key && t[key]) {
                el.innerText = t[key];
            }
        });
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

        this.btnAudio?.addEventListener('click', (e) => {
            (e.currentTarget as HTMLElement)?.blur();
            if (this.hooks.onToggleAudio) {
                const isMuted = this.hooks.onToggleAudio();
                if (this.btnAudio) this.btnAudio.innerText = isMuted ? '🔇' : '🔊';
            }
        });

        this.btnLang?.addEventListener('click', (e) => {
            (e.currentTarget as HTMLElement)?.blur();
            this.i18n.cycleLanguage();
        });

        btnPlay?.addEventListener('click', (e) => {
            (e.currentTarget as HTMLElement)?.blur();
            this.hooks.onPlay();
        });
        btnResume?.addEventListener('click', (e) => {
            (e.currentTarget as HTMLElement)?.blur();
            this.hooks.onResume();
        });
        btnRestart?.addEventListener('click', (e) => {
            (e.currentTarget as HTMLElement)?.blur();
            this.hooks.onRestart();
        });

        this.stateManager.onStateChange((newState) => {
            this.syncWithState(newState);
        });
    }

    private syncWithState(state: GameState): void {
        if (state === GameState.Playing) {
            (document.activeElement as HTMLElement)?.blur();
        }

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
