import { GameState, type IGameStateSource } from '../core/GameStateManager';
import type { ILocalizationSource } from '../core/I18nService';
import type { Unsubscribe } from '../core/Signal';
import type { Challenge } from '../game/Challenge';
import type { IProgressionView, IProfileCommands, RunRewards } from '../game/Progression';
import type { IRunState, IRunEvents } from '../game/RunSession';
import type { IRunNotices } from './RunNotices';

export interface RunUIActions {
    daily(): void;
    menu(): void;
    pause(): void;
    share(challenge: Challenge): Promise<string>;
    dailyChallenge(): Challenge;
}

export class RunUI {
    private readonly events = new AbortController();
    private readonly subscriptions: Unsubscribe[];
    private readonly elements = new Map<string, HTMLElement>();
    private timer = 0;
    private dailyKey = '';
    private result: RunRewards | null = null;

    constructor(private readonly document: Document, private readonly state: IGameStateSource,
        private readonly localization: ILocalizationSource, private readonly profile: IProgressionView & IProfileCommands,
        private readonly run: IRunState & IRunEvents, private readonly actions: RunUIActions,
        private readonly notices: IRunNotices) {
        for (const element of document.querySelectorAll<HTMLElement>('[id]')) this.elements.set(element.id, element);
        this.bind('btn-daily', () => actions.daily());
        this.bind('btn-menu', () => actions.menu());
        this.bind('btn-quit', () => actions.menu());
        this.bind('btn-pause', () => actions.pause());
        this.bind('btn-share-daily', () => { void this.share(actions.dailyChallenge()); });
        this.bind('btn-share-run', () => { void this.share(run.challenge); });
        this.bind('btn-close-share', () => { this.element('share-box').hidden = true; });
        // Persist once the slider settles; every intermediate value would save and rebuild the menu.
        this.element('motion-setting').addEventListener('change', event => {
            profile.setMotion(Number((event.target as HTMLInputElement).value) / 100);
        }, { signal: this.events.signal });
        this.element('ghost-setting').addEventListener('change', event => {
            profile.setGhost((event.target as HTMLInputElement).checked);
        }, { signal: this.events.signal });
        this.element('wardrobe').addEventListener('click', event => {
            if (state.currentState !== GameState.MainMenu) return;
            const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-cosmetic]');
            if (button?.dataset.cosmetic) profile.equip(button.dataset.cosmetic);
        }, { signal: this.events.signal });
        this.subscriptions = [
            profile.onChange(() => this.refresh()),
            localization.onChange(() => this.refresh()),
            state.onStateChange(phase => {
                if (phase === GameState.MainMenu) this.refresh();
                if (phase === GameState.Playing) this.element('share-box').hidden = true;
                else this.document.body.classList.remove('crazy-active');
            }),
            run.onEvent(event => {
                if (this.notices.accept(event)) this.renderNotice();
            })
        ];
        this.refresh();
    }

    private element(id: string): HTMLElement {
        const element = this.elements.get(id);
        if (!element) throw new Error('Missing game UI element: ' + id);
        return element;
    }

    private t(key: string): string { return this.localization.locale.translations[key] ?? key; }
    private set(id: string, value: string): void {
        const element = this.element(id);
        if (element.textContent !== value) element.textContent = value;
    }

    private bind(id: string, action: () => void): void {
        this.element(id).addEventListener('click', () => { this.element(id).blur(); action(); }, { signal: this.events.signal });
    }

    private async share(challenge: Challenge): Promise<void> {
        const url = await this.actions.share(challenge);
        if (!url || this.events.signal.aborted
            || (this.state.currentState !== GameState.MainMenu && this.state.currentState !== GameState.GameOver)) return;
        const input = this.element('share-url') as HTMLInputElement;
        input.value = url;
        this.element('share-box').hidden = false;
        input.focus();
        input.select();
    }

    private refresh(): void {
        this.set('wallet-value', String(this.profile.wallet));
        const daily = this.actions.dailyChallenge();
        this.dailyKey = daily.key;
        this.set('daily-description', `${daily.date} · ${this.t(daily.modifier)} · UTC`);
        this.set('daily-best', `${this.t('courseBest')}: ${this.profile.best(daily.key)}`);
        (this.element('motion-setting') as HTMLInputElement).value = String(Math.round(this.profile.motion * 100));
        (this.element('ghost-setting') as HTMLInputElement).checked = this.profile.ghostEnabled;
        this.document.documentElement.style.setProperty('--motion', String(this.profile.motion));
        this.document.documentElement.classList.toggle('reduced-motion', this.profile.motion === 0);
        const wardrobe = this.element('wardrobe');
        // Rebuilding the locker would otherwise drop keyboard focus after each purchase or equip.
        const active = this.document.activeElement as HTMLElement | null | undefined;
        const focusedCosmetic = active?.closest?.('#wardrobe') ? active.dataset.cosmetic : undefined;
        let refocus: HTMLButtonElement | undefined;
        wardrobe.replaceChildren();
        for (const slot of ['character', 'outfit', 'trail'] as const) {
            const group = this.document.createElement('fieldset');
            const legend = this.document.createElement('legend');
            legend.textContent = this.t(slot);
            group.append(legend);
            for (const item of this.profile.cosmetics.filter(item => item.slot === slot)) {
                const button = this.document.createElement('button');
                button.type = 'button';
                button.dataset.cosmetic = item.id;
                const selected = this.profile.appearance[slot] === item.id;
                button.setAttribute('aria-pressed', String(selected));
                button.disabled = !this.profile.canEquip(item.id);
                button.textContent = `${this.t('cosmetic_' + item.id)} · ${selected ? this.t('equipped')
                    : this.profile.owns(item.id) ? this.t('equip') : `${item.cost} ${this.t('coins')}`}`;
                if (item.id === focusedCosmetic) refocus = button;
                group.append(button);
            }
            wardrobe.append(group);
        }
        refocus?.focus();
        const missions = this.element('mission-list');
        missions.replaceChildren();
        for (const mission of this.profile.missions) {
            const row = this.document.createElement('li');
            const progress = this.profile.missionProgress(mission.id);
            row.textContent = `${progress >= mission.goal ? '✓ ' : ''}${this.t('mission_' + mission.id)} `
                + `${progress}/${mission.goal} · +${mission.reward} ${this.t('coins')}`;
            missions.append(row);
        }
        this.renderNotice();
        this.renderResults();
    }

    public start(): void {
        this.notices.reset();
        this.result = null;
        this.timer = 0.1;
        this.renderNotice();
        this.update(0, null);
    }

    private renderNotice(): void {
        const notice = this.notices.current;
        this.element('run-notice').hidden = notice === null;
        if (!notice) return;
        this.set('run-notice', this.t(notice.key) + (notice.event.value !== undefined ? ` ${notice.event.value}` : ''));
        this.element('run-notice').classList.toggle('warning', notice.warning);
    }

    public update(delta: number, ghostDistance: number | null): void {
        this.timer += delta;
        if (this.timer < 0.1) return;
        this.timer = 0;
        if (this.state.currentState === GameState.MainMenu && this.actions.dailyChallenge().key !== this.dailyKey) this.refresh();
        this.set('run-distance', `${Math.floor(this.run.stats.distance)} m`);
        this.set('run-coins', `${this.run.stats.coins} ${this.t('coins')}`);
        this.set('run-combo', `${this.t('combo')} ${this.run.combo} · ×${this.run.multiplier}`);
        this.set('run-biome', this.t(this.run.biome));
        this.set('run-mode', this.run.challenge.date ? `${this.run.challenge.date} · ${this.t(this.run.challenge.modifier)}` : this.t('freeRun'));
        const meter = this.element('crazy-meter') as HTMLProgressElement;
        meter.value = this.run.crazyRemaining > 0 ? this.run.crazyFraction * 100 : this.run.charge;
        this.set('crazy-label', this.run.crazyRemaining > 0 ? `${this.t('crazy')} ${this.run.crazyRemaining.toFixed(1)}s` : this.t('crazyCharge'));
        this.document.body.classList.toggle('crazy-active', this.state.currentState === GameState.Playing && this.run.crazyRemaining > 0);
        const powers = this.run.activePowers.map(power => power.remaining === null
            ? this.t(power.id) : `${this.t(power.id)} ${Math.ceil(power.remaining)}s`);
        this.set('run-powers', powers.join(' · '));
        this.set('ghost-delta', ghostDistance === null ? '' : `${this.t(ghostDistance >= 0 ? 'ghostAhead' : 'ghostBehind')} ${Math.abs(ghostDistance).toFixed(0)} m`);
        const mission = this.profile.missions.find(item => this.profile.missionProgress(item.id) < item.goal);
        if (mission) {
            const current = this.profile.missionProgress(mission.id, this.run.stats);
            this.set('run-mission', `${this.t('mission_' + mission.id)} ${Math.min(mission.goal, Math.floor(current))}/${mission.goal}`);
        } else this.set('run-mission', this.t('missionsComplete'));
        this.renderNotice();
    }

    public showResults(result: RunRewards): void {
        this.result = result;
        this.document.body.classList.remove('crazy-active');
        this.renderResults();
    }

    private renderResults(): void {
        if (!this.result) return;
        this.set('result-distance', `${Math.floor(this.run.stats.distance)} m`);
        this.set('result-coins', String(this.run.stats.coins));
        this.set('result-combo', String(this.run.stats.longestCombo));
        this.set('result-near', String(this.run.stats.nearMisses));
        this.set('result-chains', String(this.run.stats.chains));
        this.set('result-crazy', String(this.run.stats.crazyModes));
        this.set('result-earned', `+${this.result.earned} ${this.t('coinsBanked')}`);
        this.set('result-missions', this.result.missions.length
            ? this.result.missions.map(id => `✓ ${this.t('mission_' + id)}`).join(' · ') : this.t('keepGoing'));
        this.set('result-best', `${this.t('courseBest')}: ${this.profile.best(this.run.challenge.key)}`);
        this.element('btn-share-run').hidden = !this.run.challenge.date;
    }

    public dispose(): void { this.events.abort(); for (const unsubscribe of this.subscriptions) unsubscribe(); }
}
