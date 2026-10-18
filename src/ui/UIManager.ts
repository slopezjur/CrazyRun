import { GameState, type IGameStateSource } from '../core/GameStateManager';
import type { ILocalization, Locale, Translations } from '../core/I18nService';
import type { Unsubscribe } from '../core/Signal';
import type { IAudioControl } from '../game/AudioManager';
import type { IGameCommands } from '../game/GameController';

const PANELS: ReadonlyMap<GameState, string> = new Map([
    [GameState.MainMenu, 'panel-main-menu'],
    [GameState.Playing, 'panel-hud'],
    [GameState.Paused, 'panel-paused'],
    [GameState.GameOver, 'panel-game-over']
]);

export class UIManager {
    private readonly events = new AbortController();
    private readonly panels = new Map<GameState, HTMLElement | null>();
    private readonly scoreDisplay: HTMLElement | null;
    private readonly finalScoreDisplay: HTMLElement | null;
    private readonly highScoreDisplay: HTMLElement | null;
    private readonly languageButton: HTMLElement | null;
    private readonly audioButton: HTMLElement | null;
    private readonly subscriptions: Unsubscribe[];

    constructor(
        private readonly document: Document,
        state: IGameStateSource,
        localization: ILocalization,
        audio: IAudioControl,
        commands: IGameCommands
    ) {
        for (const [phase, id] of PANELS) this.panels.set(phase, document.getElementById(id));
        this.scoreDisplay = document.getElementById('score-display');
        this.finalScoreDisplay = document.getElementById('final-score-display');
        this.highScoreDisplay = document.getElementById('high-score-display');
        this.languageButton = document.getElementById('btn-lang');
        this.audioButton = document.getElementById('btn-audio');
        const updateAudio = (): void => {
            if (this.audioButton) this.audioButton.textContent = audio.isMuted ? '🔇' : '🔊';
        };
        this.bindButton('btn-play', () => commands.play());
        this.bindButton('btn-resume', () => commands.resume());
        this.bindButton('btn-restart', () => commands.restart());
        this.bindButton('btn-lang', () => localization.cycleLanguage());
        this.bindButton('btn-audio', () => {
            audio.toggleMute();
            updateAudio();
        });
        this.subscriptions = [
            state.onStateChange(phase => this.syncWithState(phase)),
            localization.onChange(locale => this.applyTranslations(locale))
        ];
        updateAudio();
        this.syncWithState(state.currentState);
    }

    private bindButton(id: string, action: () => void): void {
        const button = this.document.getElementById(id);
        button?.addEventListener('click', () => {
            button.blur();
            action();
        }, { signal: this.events.signal });
    }

    private applyTranslations(locale: Locale): void {
        if (this.languageButton) this.languageButton.textContent = locale.label;
        this.document.documentElement.lang = locale.id;
        for (const element of this.document.querySelectorAll<HTMLElement>('[data-i18n]')) {
            const key = element.dataset.i18n as keyof Translations | undefined;
            if (key && key in locale.translations) element.textContent = locale.translations[key];
        }
        for (const element of this.document.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
            const key = element.dataset.i18nAria;
            if (key && key in locale.translations) element.setAttribute('aria-label', locale.translations[key]);
        }
    }

    public updateLiveScore(score: number): void {
        if (this.scoreDisplay) this.scoreDisplay.textContent = String(score);
    }

    public updateFinalScores(score: number, highScore: number): void {
        if (this.finalScoreDisplay) this.finalScoreDisplay.textContent = String(score);
        if (this.highScoreDisplay) this.highScoreDisplay.textContent = String(highScore);
    }

    private syncWithState(state: GameState): void {
        if (state === GameState.Playing) {
            const active = this.document.activeElement;
            if (active && 'blur' in active && typeof active.blur === 'function') active.blur();
        }
        for (const [phase, element] of this.panels) {
            element?.classList.toggle('hidden', phase !== state);
            element?.classList.toggle('active', phase === state);
        }
    }

    public dispose(): void {
        this.events.abort();
        for (const unsubscribe of this.subscriptions) unsubscribe();
    }
}
