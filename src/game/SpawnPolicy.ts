export interface SpawnData {
    readonly chainId?: number;
    readonly chainSize?: number;
    readonly phase?: number;
}

export type SpawnEntity = (id: string, x: number, y: number, z: number, data?: SpawnData) => void;

export interface ISpawnPolicy {
    spawn(chunkZ: number, spawn: SpawnEntity): void;
}

export interface SpawnChoice {
    readonly id: string;
    readonly weight: number;
}

export class LaneSpawnPolicy implements ISpawnPolicy {
    private readonly laneOrder: number[];
    private readonly obstacleWeight: number;
    private readonly collectibleWeight: number;

    constructor(
        private readonly lanes: readonly number[],
        private readonly obstacles: readonly SpawnChoice[],
        private readonly collectibles: readonly SpawnChoice[],
        private readonly random: () => number
    ) {
        if (lanes.length === 0) throw new Error('At least one lane is required.');
        this.laneOrder = [...lanes];
        this.obstacleWeight = this.totalWeight(obstacles);
        this.collectibleWeight = this.totalWeight(collectibles);
    }

    private totalWeight(choices: readonly SpawnChoice[]): number {
        let total = 0;
        for (const choice of choices) {
            if (!Number.isFinite(choice.weight) || choice.weight <= 0) {
                throw new RangeError('Spawn weights must be positive and finite.');
            }
            total += choice.weight;
        }
        return total;
    }

    private choose(choices: readonly SpawnChoice[], total: number): string | undefined {
        if (choices.length === 0) return undefined;
        let threshold = this.random() * total;
        for (const choice of choices) {
            threshold -= choice.weight;
            if (threshold < 0) return choice.id;
        }
        return choices[choices.length - 1].id;
    }

    public spawn(chunkZ: number, spawn: SpawnEntity): void {
        const count = Math.floor(this.random() * this.lanes.length);
        for (let i = 0; i < this.lanes.length; i++) this.laneOrder[i] = this.lanes[i];
        for (let i = this.laneOrder.length - 1; i > 0; i--) {
            const index = Math.floor(this.random() * (i + 1));
            const lane = this.laneOrder[i];
            this.laneOrder[i] = this.laneOrder[index];
            this.laneOrder[index] = lane;
        }
        for (let i = 0; i < this.laneOrder.length; i++) {
            const id = i < count
                ? this.choose(this.obstacles, this.obstacleWeight)
                : this.random() > 0.5 ? this.choose(this.collectibles, this.collectibleWeight) : undefined;
            if (id !== undefined) spawn(id, this.laneOrder[i], 0, chunkZ);
        }
    }
}
