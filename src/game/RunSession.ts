import { Signal, type Unsubscribe } from '../core/Signal';
import { biomeAt, spectacleAt, MAX_SPEED, MODIFIER_RULES, type Biome, type Challenge } from './Challenge';
import type { ActivePowerUp, IRunPowerUps, PowerUp } from './PowerUps';
export type { PowerUp } from './PowerUps';

const CRAZY_DURATION = 7;
export type RunNotice = 'chain' | 'nearMiss' | 'crazy' | 'shieldSaved' | 'milestone'
    | 'biome' | 'warning' | 'spectacle' | 'powerUp' | 'combo';
interface RunEventData {
    readonly value?: number;
    readonly position?: readonly [number, number, number];
}
export type RunEvent = RunEventData & (
    | { readonly type: Exclude<RunNotice, 'powerUp'> | 'coin' | 'smash' }
    | { readonly type: 'powerUp'; readonly powerUp: PowerUp }
);

export interface RunStats {
    distance: number;
    coins: number;
    clears: number;
    arches: number;
    nearMisses: number;
    chains: number;
    longestCombo: number;
    crazyModes: number;
}

function emptyStats(): RunStats {
    return { distance: 0, coins: 0, clears: 0, arches: 0, nearMisses: 0, chains: 0, longestCombo: 0, crazyModes: 0 };
}

export interface IRunState {
    readonly stats: Readonly<RunStats>;
    readonly elapsed: number;
    readonly combo: number;
    readonly charge: number;
    readonly crazyRemaining: number;
    readonly crazyFraction: number;
    readonly activePowers: readonly ActivePowerUp[];
    readonly attractsCoins: boolean;
    readonly shield: boolean;
    readonly graceRemaining: number;
    readonly biome: Biome;
    readonly spectacle: ReturnType<typeof spectacleAt>;
    readonly challenge: Challenge;
    readonly multiplier: number;
    readonly timeScale: number;
}
export interface IRunEvents { onEvent(listener: (event: RunEvent) => void): Unsubscribe; }
export interface IRunSimulation extends Pick<IRunState, 'combo' | 'multiplier' | 'timeScale'> {
    readonly speed: number;
    advance(delta: number, distance: number): void;
    reset(): void;
}
export interface IRunRewardsPolicy {
    collectCoin(chain: number | undefined, size: number, position: readonly [number, number, number]): number;
    missChain(chain: number | undefined): void;
    clearObstacle(arch: boolean, nearMiss: boolean): number;
    pickUp(power: PowerUp): void;
    absorbHit(position: readonly [number, number, number]): boolean;
}

/** Gameplay time and rewards are advanced exclusively by the fixed simulation. */
export class RunSession implements IRunState, IRunEvents, IRunSimulation, IRunRewardsPolicy {
    private statsValue = emptyStats();
    private elapsedValue = 0;
    private comboValue = 0;
    private chargeValue = 0;
    private crazyRemainingValue = 0;
    private graceRemainingValue = 0;
    private biomeValue: Biome = 'city';
    private spectacleValue: ReturnType<typeof spectacleAt> = 'none';
    private comboRemaining = 0;
    private nextMilestone = 500;
    private readonly chains = new Map<number, { count: number; expires: number }>();
    private readonly events = new Signal<RunEvent>();

    constructor(private challengeValue: Challenge, private readonly powers: IRunPowerUps) {}

    public get challenge(): Challenge { return this.challengeValue; }
    public selectChallenge(challenge: Challenge): void { this.challengeValue = challenge; }
    public get stats(): Readonly<RunStats> { return this.statsValue; }
    public get elapsed(): number { return this.elapsedValue; }
    public get combo(): number { return this.comboValue; }
    public get charge(): number { return this.chargeValue; }
    public get crazyRemaining(): number { return this.crazyRemainingValue; }
    public get crazyFraction(): number { return this.crazyRemainingValue / CRAZY_DURATION; }
    public get activePowers(): readonly ActivePowerUp[] { return this.powers.active; }
    public get attractsCoins(): boolean { return this.powers.attractsCoins || this.crazyRemainingValue > 0; }
    public get shield(): boolean { return this.powers.hasProtection; }
    public get graceRemaining(): number { return this.graceRemainingValue; }
    public get biome(): Biome { return this.biomeValue; }
    public get spectacle(): ReturnType<typeof spectacleAt> { return this.spectacleValue; }
    public get speed(): number {
        const base = Math.min(MAX_SPEED, MODIFIER_RULES[this.challenge.modifier].startingSpeed + this.elapsed);
        return this.crazyRemaining > 0 ? Math.min(MAX_SPEED, base * 1.25) : base;
    }

    public get multiplier(): number { return (1 + Math.min(4, Math.floor(this.comboValue / 5))) * (this.crazyRemainingValue > 0 ? 3 : 1); }
    public get timeScale(): number { return this.powers.timeScale; }

    public onEvent(listener: (event: RunEvent) => void): Unsubscribe { return this.events.subscribe(listener); }

    public reset(challenge = this.challenge): void {
        this.challengeValue = challenge;
        this.statsValue = emptyStats();
        this.elapsedValue = this.comboValue = this.chargeValue = this.crazyRemainingValue = 0;
        this.graceRemainingValue = this.comboRemaining = 0;
        this.powers.reset();
        this.biomeValue = 'city';
        this.spectacleValue = 'none';
        this.nextMilestone = 500;
        this.chains.clear();
    }

    public advance(delta: number, distance: number): void {
        this.elapsedValue += delta;
        this.statsValue.distance += distance;
        for (const [id, chain] of this.chains) {
            if (chain.expires < this.statsValue.distance) this.chains.delete(id);
        }
        for (const key of ['crazyRemainingValue', 'graceRemainingValue', 'comboRemaining'] as const) {
            this[key] = Math.max(0, this[key] - delta);
        }
        this.powers.advance(delta);
        if (this.comboRemaining === 0) this.comboValue = 0;
        const biome = biomeAt(this.statsValue.distance);
        if (biome !== this.biomeValue) {
            this.biomeValue = biome;
            this.events.emit({ type: 'biome' });
        }
        const spectacle = spectacleAt(this.statsValue.distance);
        if (spectacle !== this.spectacleValue) {
            this.spectacleValue = spectacle;
            if (spectacle !== 'none') this.events.emit({ type: spectacle === 'warning' ? 'warning' : 'spectacle' });
        }
        if (this.statsValue.distance >= this.nextMilestone) {
            this.events.emit({ type: 'milestone', value: this.nextMilestone });
            this.nextMilestone += 500;
        }
    }

    private skill(charge: number): void {
        this.comboValue++;
        this.comboRemaining = 7;
        this.statsValue.longestCombo = Math.max(this.statsValue.longestCombo, this.comboValue);
        if (this.comboValue % 5 === 0) this.events.emit({ type: 'combo', value: this.comboValue });
        if (this.crazyRemainingValue > 0) return;
        this.chargeValue = Math.min(100, this.chargeValue + charge * MODIFIER_RULES[this.challenge.modifier].chargeMultiplier);
        if (this.chargeValue === 100) {
            this.chargeValue = 0;
            this.crazyRemainingValue = CRAZY_DURATION;
            this.statsValue.crazyModes++;
            this.events.emit({ type: 'crazy' });
        }
    }

    public collectCoin(chain: number | undefined, size: number, position: readonly [number, number, number]): number {
        this.statsValue.coins++;
        this.comboRemaining = Math.max(this.comboRemaining, 3);
        this.events.emit({ type: 'coin', position });
        let bonus = 0;
        if (chain !== undefined) {
            const count = (this.chains.get(chain)?.count ?? 0) + 1;
            this.chains.set(chain, { count, expires: this.statsValue.distance + 80 });
            if (count === size) {
                this.chains.delete(chain);
                this.statsValue.chains++;
                bonus = 250;
                this.events.emit({ type: 'chain' });
                this.skill(18);
            }
        }
        return (100 * MODIFIER_RULES[this.challenge.modifier].coinMultiplier + bonus) * this.multiplier;
    }

    public missChain(chain: number | undefined): void {
        if (chain !== undefined) this.chains.delete(chain);
    }

    public clearObstacle(arch: boolean, nearMiss: boolean): number {
        this.statsValue.clears++;
        if (arch) this.statsValue.arches++;
        if (nearMiss) {
            this.statsValue.nearMisses++;
            this.events.emit({ type: 'nearMiss' });
        }
        this.skill(nearMiss ? 12 : 7);
        return (nearMiss ? 100 : 40) * this.multiplier;
    }

    public pickUp(power: PowerUp): void {
        this.powers.activate(power);
        this.events.emit({ type: 'powerUp', powerUp: power });
    }

    public absorbHit(position: readonly [number, number, number]): boolean {
        if (this.crazyRemainingValue > 0 || this.graceRemainingValue > 0) {
            this.events.emit({ type: 'smash', position });
            return true;
        }
        if (!this.powers.consumeProtection()) return false;
        this.graceRemainingValue = 1.5;
        this.comboValue = this.comboRemaining = 0;
        this.events.emit({ type: 'shieldSaved', position });
        return true;
    }

    public dispose(): void { this.events.clear(); }
}
