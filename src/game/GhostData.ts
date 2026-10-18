export const MAX_GHOST_FRAMES = 6000;

// time, distance, x, y, vertical scale, tilt; ghosts never participate in collisions.
export type GhostFrame = [number, number, number, number, number, number];
export interface GhostRecord {
    readonly key: string;
    readonly score: number;
    readonly frames: readonly Readonly<GhostFrame>[];
}
export interface IGhostPlayback { sample(time: number, result: GhostFrame): boolean; }
