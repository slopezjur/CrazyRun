import type { RunStats } from './RunSession';

export type CosmeticSlot = 'character' | 'outfit' | 'trail';
export interface Appearance { character: string; outfit: string; trail: string; }
export interface CosmeticDefinition {
    readonly id: string;
    readonly slot: CosmeticSlot;
    readonly cost: number;
}
export interface MissionDefinition {
    readonly id: string;
    readonly goal: number;
    readonly reward: number;
    progress(previous: number, stats: Readonly<RunStats>): number;
}
export interface ProgressionRules {
    readonly cosmetics: readonly CosmeticDefinition[];
    readonly missions: readonly MissionDefinition[];
    readonly defaultAppearance: Readonly<Appearance>;
}

export const boundedCount = (value: unknown): number => typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1_000_000_000, Math.floor(value))) : 0;

function cumulative(id: string, stat: keyof RunStats, goal: number, reward: number): MissionDefinition {
    return { id, goal, reward, progress: (previous, stats) => previous + boundedCount(stats[stat]) };
}

export const COSMETICS: readonly CosmeticDefinition[] = [
    { id: 'runner', slot: 'character', cost: 0 },
    { id: 'robot', slot: 'character', cost: 150 },
    { id: 'comet', slot: 'character', cost: 300 },
    { id: 'lime', slot: 'outfit', cost: 0 },
    { id: 'violet', slot: 'outfit', cost: 80 },
    { id: 'sunset', slot: 'outfit', cost: 120 },
    { id: 'none', slot: 'trail', cost: 0 },
    { id: 'cyan', slot: 'trail', cost: 100 },
    { id: 'gold', slot: 'trail', cost: 200 }
];

export const MISSIONS: readonly MissionDefinition[] = [
    cumulative('collector', 'coins', 50, 75),
    cumulative('slider', 'arches', 5, 75),
    cumulative('chainHunter', 'chains', 3, 100),
    cumulative('daredevil', 'nearMisses', 10, 100),
    cumulative('traveller', 'distance', 3000, 150),
    { id: 'comboMaster', goal: 15, reward: 150,
        progress: (previous, stats) => Math.max(previous, boundedCount(stats.longestCombo)) },
    cumulative('unstoppable', 'crazyModes', 3, 200)
];

export const PROGRESSION_RULES: ProgressionRules = {
    cosmetics: COSMETICS, missions: MISSIONS,
    defaultAppearance: { character: 'runner', outfit: 'lime', trail: 'none' }
};

export interface ProfileData {
    version: 1;
    wallet: number;
    owned: string[];
    appearance: Appearance;
    progress: Record<string, number>;
    completed: string[];
    motion: number;
    ghost: boolean;
    bests: Record<string, number>;
}

export function emptyProfile(rules: ProgressionRules, reducedMotion = false): ProfileData {
    return {
        version: 1, wallet: 0, owned: Object.values(rules.defaultAppearance),
        appearance: { ...rules.defaultAppearance }, progress: {}, completed: [],
        motion: reducedMotion ? 0 : 0.65, ghost: true, bests: {}
    };
}
