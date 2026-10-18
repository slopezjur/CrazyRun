import type { IValueStorage } from '../core/StorageService';
import { Signal, type Unsubscribe } from '../core/Signal';
import type { RunStats } from './RunSession';
import {
    boundedCount, PROGRESSION_RULES, type Appearance, type CosmeticDefinition,
    type MissionDefinition, type ProfileData, type ProgressionRules
} from './ProgressionRules';

export type { Appearance, CosmeticSlot } from './ProgressionRules';
export { COSMETICS, MISSIONS } from './ProgressionRules';

export interface RunRewards { earned: number; missions: string[]; }
export interface IAppearanceSource {
    readonly appearance: Readonly<Appearance>;
    readonly motion: number;
    readonly ghostEnabled: boolean;
}
export interface IProgressionView extends IAppearanceSource {
    readonly wallet: number;
    readonly cosmetics: readonly CosmeticDefinition[];
    readonly missions: readonly MissionDefinition[];
    owns(id: string): boolean;
    canEquip(id: string): boolean;
    missionProgress(id: string, run?: Readonly<RunStats>): number;
    best(key: string): number;
    onChange(listener: () => void): Unsubscribe;
}
export interface IProfileCommands {
    equip(id: string): boolean;
    setMotion(value: number): void;
    setGhost(value: boolean): void;
}
export interface IRunRewards {
    finish(stats: Readonly<RunStats>, score: number, key: string): RunRewards;
}

export class Progression implements IProgressionView, IProfileCommands, IRunRewards {
    private readonly profile: ProfileData;
    private readonly changed = new Signal<void>();

    constructor(
        private readonly storage: IValueStorage<ProfileData>,
        private readonly rules: ProgressionRules = PROGRESSION_RULES
    ) { this.profile = storage.load(); }

    public get wallet(): number { return this.profile.wallet; }
    public get appearance(): Readonly<Appearance> { return this.profile.appearance; }
    public get motion(): number { return this.profile.motion; }
    public get ghostEnabled(): boolean { return this.profile.ghost; }
    public get cosmetics(): readonly CosmeticDefinition[] { return this.rules.cosmetics; }
    public get missions(): readonly MissionDefinition[] { return this.rules.missions; }
    public owns(id: string): boolean { return this.profile.owned.includes(id); }
    public best(key: string): number { return this.profile.bests[key] ?? 0; }
    public onChange(listener: () => void): Unsubscribe { return this.changed.subscribe(listener); }

    public missionProgress(id: string, run?: Readonly<RunStats>): number {
        const previous = this.profile.progress[id] ?? 0;
        const mission = this.missions.find(item => item.id === id);
        return mission && run ? Math.min(mission.goal, boundedCount(mission.progress(previous, run))) : previous;
    }

    public canEquip(id: string): boolean {
        const item = this.cosmetics.find(entry => entry.id === id);
        return item !== undefined && (this.owns(id) || this.profile.wallet >= item.cost);
    }

    private save(): void {
        this.storage.save(this.profile);
        this.changed.emit(undefined);
    }

    public equip(id: string): boolean {
        const item = this.cosmetics.find(entry => entry.id === id);
        if (!item || !this.canEquip(id)) return false;
        if (!this.owns(id)) {
            this.profile.wallet -= item.cost;
            this.profile.owned.push(id);
        }
        this.profile.appearance[item.slot] = id;
        this.save();
        return true;
    }

    public setMotion(value: number): void {
        if (!Number.isFinite(value)) return;
        this.profile.motion = Math.max(0, Math.min(1, value));
        this.save();
    }

    public setGhost(value: boolean): void { this.profile.ghost = value; this.save(); }

    public finish(stats: Readonly<RunStats>, score: number, key: string): RunRewards {
        let earned = boundedCount(stats.coins);
        const missions: string[] = [];
        for (const mission of this.missions) {
            this.profile.progress[mission.id] = this.missionProgress(mission.id, stats);
            if (this.profile.progress[mission.id] >= mission.goal && !this.profile.completed.includes(mission.id)) {
                this.profile.completed.push(mission.id);
                missions.push(mission.id);
                earned += mission.reward;
            }
        }
        this.profile.wallet = boundedCount(this.profile.wallet + earned);
        this.profile.bests[key] = Math.max(this.best(key), boundedCount(score));
        const keys = Object.keys(this.profile.bests);
        for (const old of keys.slice(0, Math.max(0, keys.length - 32))) delete this.profile.bests[old];
        this.save();
        return { earned, missions };
    }

    public dispose(): void { this.changed.clear(); }
}
