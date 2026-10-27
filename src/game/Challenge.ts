// v2: lane blockers became taller than the highest jump, so v1 bests, ghosts, and links no longer apply.
export const COURSE_VERSION = 2;
export const ROW_SPACING = 80;
export const MAX_SPEED = 80;
export const BIOME_LENGTH = 960;

export type Biome = 'city' | 'tunnel' | 'rooftops';
export const MODIFIER_RULES = {
    standard: { startingSpeed: 30, coinMultiplier: 1, chargeMultiplier: 1 },
    coinRush: { startingSpeed: 30, coinMultiplier: 2, chargeMultiplier: 1 },
    rapidCharge: { startingSpeed: 30, coinMultiplier: 1, chargeMultiplier: 1.5 },
    fastStart: { startingSpeed: 40, coinMultiplier: 1, chargeMultiplier: 1 }
} as const;
export type Modifier = keyof typeof MODIFIER_RULES;

export interface Challenge {
    readonly seed: string;
    readonly date?: string;
    readonly modifier: Modifier;
    readonly key: string;
}

export function hashSeed(seed: string): number {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
    return hash >>> 0;
}

export function seededRandom(seed: string): () => number {
    let value = hashSeed(seed);
    return () => {
        value += 0x6D2B79F5;
        let next = Math.imul(value ^ value >>> 15, value | 1);
        next ^= next + Math.imul(next ^ next >>> 7, next | 61);
        return ((next ^ next >>> 14) >>> 0) / 4294967296;
    };
}

export function endlessChallenge(seed: string): Challenge {
    return { seed, modifier: 'standard', key: `v${COURSE_VERSION}:free:${seed}` };
}

export function dailyChallenge(date = new Date().toISOString().slice(0, 10)): Challenge {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
        || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
        throw new RangeError('Invalid challenge date.');
    }
    const modifiers: readonly Modifier[] = ['coinRush', 'rapidCharge', 'fastStart'];
    const modifier = modifiers[hashSeed(date) % modifiers.length];
    return { seed: `daily:${date}`, date, modifier, key: `v${COURSE_VERSION}:daily:${date}:${modifier}` };
}

export function challengeFromUrl(url: URL): Challenge | null {
    if (url.searchParams.get('v') !== String(COURSE_VERSION)) return null;
    const date = url.searchParams.get('challenge');
    if (!date) return null;
    try { return dailyChallenge(date); } catch { return null; }
}

export function challengeUrl(base: string, challenge: Challenge): string | null {
    if (!challenge.date) return null;
    const url = new URL(base);
    url.search = '';
    url.hash = '';
    url.searchParams.set('challenge', challenge.date);
    url.searchParams.set('v', String(COURSE_VERSION));
    return url.href;
}

export function biomeAt(distance: number): Biome {
    return (['city', 'tunnel', 'rooftops'] as const)[Math.floor(distance / BIOME_LENGTH) % 3];
}

export function spectacleAt(distance: number): 'none' | 'warning' | 'active' {
    const offset = distance % BIOME_LENGTH;
    return offset >= 560 && offset < 640 ? 'warning' : offset >= 640 && offset < 880 ? 'active' : 'none';
}
