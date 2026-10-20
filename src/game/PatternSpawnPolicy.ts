import { biomeAt, MAX_SPEED, ROW_SPACING, seededRandom, spectacleAt, type Challenge, type Biome } from './Challenge';
import { POWER_UP_IDS, type PowerUp } from './PowerUps';
import type { ISpawnPolicy, SpawnEntity } from './SpawnPolicy';

export interface PatternRow {
    readonly safeLane: number;
    readonly actionLane: number;
    readonly action: 'hurdle' | 'arch' | 'wall';
}

/** A full-speed runner can land a jump and cross two lanes between rows. */
export function validatePattern(rows: readonly PatternRow[], spacing = ROW_SPACING, speed = MAX_SPEED): boolean {
    return rows.length > 0 && Number.isFinite(spacing) && Number.isFinite(speed) && speed > 0
        && spacing / speed >= 1
        && rows.every(row => Number.isInteger(row.safeLane) && Math.abs(row.safeLane) <= 1
            && Number.isInteger(row.actionLane) && Math.abs(row.actionLane) <= 1 && row.safeLane !== row.actionLane);
}

export function createPattern(seed: string, block: number): readonly PatternRow[] {
    const random = seededRandom(`${seed}:pattern:${block}`);
    const mirror = random() < 0.5 ? -1 : 1;
    const slalom = random() < 0.35;
    const rows: PatternRow[] = slalom
        ? [0, mirror, 0].map((safeLane, index) => ({
            safeLane, actionLane: index === 1 ? 0 : -mirror, action: 'wall' as const
        }))
        : (['hurdle', 'arch', 'hurdle'] as const).map((action, index) => ({
            safeLane: index === 1 ? 0 : -mirror, actionLane: mirror, action
        }));
    if (!validatePattern(rows)) throw new Error('Unreachable course pattern.');
    return rows;
}

export interface BiomeCourse {
    readonly actions: Readonly<Partial<Record<PatternRow['action'], string>>>;
    readonly blocker: string;
    readonly spectacleBlocker: string;
}
export const BIOME_COURSES: Readonly<Record<Biome, BiomeCourse>> = {
    city: { actions: {}, blocker: 'barrier', spectacleBlocker: 'convoy' },
    tunnel: { actions: { arch: 'gate' }, blocker: 'wall', spectacleBlocker: 'gate' },
    rooftops: { actions: { hurdle: 'gap' }, blocker: 'wall', spectacleBlocker: 'gap' }
};

const jumpCoinHeight = (coin: number): number => 1.5 * Math.sin(Math.PI * (coin + 1) / 6);
export const ACTION_COIN_PATHS: Readonly<Record<string, (coin: number) => number>> = {
    hurdle: jumpCoinHeight, gap: jumpCoinHeight,
    arch: () => -0.45, gate: () => -0.45
};

export class PatternSpawnPolicy implements ISpawnPolicy {
    constructor(
        private readonly context: () => { challenge: Challenge; distance: number },
        private readonly biomes: Readonly<Record<Biome, BiomeCourse>> = BIOME_COURSES,
        private readonly coinPaths: Readonly<Record<string, (coin: number) => number>> = ACTION_COIN_PATHS,
        private readonly powerUps: readonly PowerUp[] = POWER_UP_IDS
    ) {}

    public spawn(z: number, spawn: SpawnEntity): void {
        const { challenge, distance } = this.context();
        const index = Math.round((distance - z) / ROW_SPACING);
        const random = seededRandom(`${challenge.seed}:row:${index}`);
        const row = createPattern(challenge.seed, Math.floor(index / 3))[index % 3];
        const at = index * ROW_SPACING;
        const biome = biomeAt(at);
        const event = spectacleAt(at) === 'active';
        const remaining = [-1, 0, 1].find(lane => lane !== row.safeLane && lane !== row.actionLane)!;
        const course = this.biomes[biome];
        const action = course.actions[row.action] ?? row.action;
        const blocker = event ? course.spectacleBlocker : course.blocker;
        spawn(action, row.actionLane * 1.5, 0, z, { phase: random() * Math.PI * 2 });
        spawn(blocker, remaining * 1.5, 0, z, { phase: random() * Math.PI * 2 });

        // Two readable routes: a short safe chain and a richer action chain.
        for (let coin = 0; coin < 3; coin++) {
            spawn('coin', row.safeLane * 1.5, 0, z + 12 - coin * 6,
                { chainId: index * 2, chainSize: 3 });
        }
        const coinHeight = this.coinPaths[action];
        if (coinHeight) {
            for (let coin = 0; coin < 5; coin++) {
                const height = coinHeight(coin);
                spawn('coin', row.actionLane * 1.5, height, z + 12 - coin * 6,
                    { chainId: index * 2 + 1, chainSize: 5 });
            }
        }
        if (index % 4 === 2 && this.powerUps.length > 0) {
            const power = this.powerUps[Math.floor(random() * this.powerUps.length)];
            // The pickup follows the action, after clearance, in the direction of travel.
            spawn(power, row.actionLane * 1.5, 0, z - 22);
        }
    }
}
