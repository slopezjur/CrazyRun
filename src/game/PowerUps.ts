export type PowerUp = string;

export interface PowerUpDefinition {
    readonly id: PowerUp;
    readonly duration: number | null;
    readonly attractsCoins?: boolean;
    readonly protection?: boolean;
    readonly timeScale?: number;
    readonly displayOrder?: number;
}
export interface ActivePowerUp {
    readonly id: PowerUp;
    readonly remaining: number | null;
}
export interface IRunPowerUps {
    readonly active: readonly ActivePowerUp[];
    readonly attractsCoins: boolean;
    readonly hasProtection: boolean;
    readonly timeScale: number;
    activate(id: PowerUp): void;
    consumeProtection(): boolean;
    advance(delta: number): void;
    reset(): void;
}

export const POWER_UP_DEFINITIONS: readonly PowerUpDefinition[] = [
    { id: 'magnet', duration: 10, attractsCoins: true, displayOrder: 1 },
    { id: 'shield', duration: null, protection: true, displayOrder: 0 },
    { id: 'slow', duration: 5, timeScale: 0.55, displayOrder: 2 }
];
// This order participates in seeded course generation.
export const POWER_UP_IDS: readonly PowerUp[] = POWER_UP_DEFINITIONS.map(definition => definition.id);

interface PowerState {
    readonly definition: PowerUpDefinition;
    active: boolean;
    remaining: number;
}

export class PowerUpEffects implements IRunPowerUps {
    private readonly states: PowerState[] = [];
    private readonly byId = new Map<PowerUp, PowerState>();
    private readonly display: readonly PowerState[];

    constructor(definitions: readonly PowerUpDefinition[]) {
        for (const definition of definitions) {
            if (!definition.id || this.byId.has(definition.id)) throw new Error('Power-up IDs must be unique and non-empty.');
            if (definition.duration !== null && (!Number.isFinite(definition.duration) || definition.duration <= 0)) {
                throw new RangeError('Timed power-ups require a positive, finite duration.');
            }
            if (definition.timeScale !== undefined
                && (!Number.isFinite(definition.timeScale) || definition.timeScale <= 0 || definition.timeScale > 1)) {
                throw new RangeError('Power-up time scales must be in (0, 1].');
            }
            const state: PowerState = { definition, active: false, remaining: 0 };
            this.states.push(state);
            this.byId.set(definition.id, state);
        }
        this.display = [...this.states].sort((a, b) => (a.definition.displayOrder ?? 0) - (b.definition.displayOrder ?? 0));
    }

    public get active(): readonly ActivePowerUp[] {
        const active: ActivePowerUp[] = [];
        for (const state of this.display) {
            if (state.active) active.push({ id: state.definition.id, remaining: state.definition.duration === null ? null : state.remaining });
        }
        return active;
    }

    public get attractsCoins(): boolean {
        for (const state of this.states) if (state.active && state.definition.attractsCoins) return true;
        return false;
    }

    public get hasProtection(): boolean {
        for (const state of this.states) if (state.active && state.definition.protection) return true;
        return false;
    }

    public get timeScale(): number {
        let scale = 1;
        for (const state of this.states) {
            if (state.active && state.definition.timeScale !== undefined) scale = Math.min(scale, state.definition.timeScale);
        }
        return scale;
    }

    public activate(id: PowerUp): void {
        const state = this.byId.get(id);
        if (!state) throw new RangeError('Unknown power-up: ' + id);
        state.active = true;
        state.remaining = state.definition.duration ?? 0;
    }

    public consumeProtection(): boolean {
        for (const state of this.states) {
            if (state.active && state.definition.protection) {
                state.active = false;
                state.remaining = 0;
                return true;
            }
        }
        return false;
    }

    public advance(delta: number): void {
        for (const state of this.states) {
            if (!state.active || state.definition.duration === null) continue;
            state.remaining = Math.max(0, state.remaining - delta);
            if (state.remaining === 0) state.active = false;
        }
    }

    public reset(): void {
        for (const state of this.states) {
            state.active = false;
            state.remaining = 0;
        }
    }
}
