import Stats from 'three/examples/jsm/libs/stats.module.js';
import { GameState, type IGameStateSource } from '../core/GameStateManager';
import type { Unsubscribe } from '../core/Signal';
import type { IFrameObserver } from '../core/Engine';

export class Diagnostics implements IFrameObserver {
    private readonly stats = new Stats();
    private readonly subscriptions: Unsubscribe[];
    private readonly element: HTMLElement | null;
    private rate = 0;

    constructor(
        document: Document,
        private readonly state: IGameStateSource,
        rates: { onUpdateRate(listener: (rate: number) => void): Unsubscribe },
        enabled = true
    ) {
        this.element = document.getElementById('debug-overlay');
        if (enabled) document.body.appendChild(this.stats.dom);
        if (this.element) this.element.hidden = !enabled;
        this.subscriptions = [
            state.onStateChange(() => this.render()),
            rates.onUpdateRate(rate => {
                this.rate = rate;
                this.render();
            })
        ];
        this.render();
    }

    private render(): void {
        if (this.element) {
            this.element.innerHTML = 'State: ' + GameState[this.state.currentState] + '<br>UPS: ' + this.rate;
        }
    }

    public begin(): void {
        this.stats.begin();
    }

    public end(): void {
        this.stats.end();
    }

    public dispose(): void {
        for (const unsubscribe of this.subscriptions) unsubscribe();
        this.stats.dom.remove();
    }
}
