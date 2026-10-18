import type { ICollisionSource, ICollisionTarget } from './CollisionManager';
import type { IManagedEntity, IAnimatedEntity } from './entities/Entity';
import type { IEntityPool } from './entities/EntityPool';
import type { ISpawnPolicy, SpawnData } from './SpawnPolicy';

export interface IEntityManager {
    spawnOnChunk(z: number): void;
    scroll(amount: number): void;
    update(delta: number): void;
    reset(): void;
}

export class EntityManager implements IEntityManager, ICollisionSource {
    constructor(
        private readonly pools: ReadonlyMap<string, IEntityPool<IManagedEntity>>,
        private readonly spawnPolicy: ISpawnPolicy,
        private readonly animatedEntities: readonly IAnimatedEntity[] = [],
        private readonly despawnZ = 10
    ) {}

    private readonly spawnEntity = (id: string, x: number, y: number, z: number, data?: SpawnData): void => {
        const pool = this.pools.get(id);
        if (!pool) throw new Error('Unknown entity pool: ' + id);
        const entity = pool.getInactive();
        if (!entity) throw new Error('Entity pool exhausted: ' + id);
        entity.spawn(x, y, z, data);
    };

    public forEachActive(visitor: (target: ICollisionTarget) => boolean): void {
        for (const pool of this.pools.values()) {
            for (const entity of pool.getAll()) {
                if (entity.isActive && !visitor(entity)) return;
            }
        }
    }

    public spawnOnChunk(z: number): void {
        this.spawnPolicy.spawn(z, this.spawnEntity);
    }

    public scroll(amount: number): void {
        for (const pool of this.pools.values()) {
            for (const entity of pool.getAll()) {
                entity.scroll(amount);
                if (entity.isActive && entity.z > this.despawnZ) entity.expire();
            }
        }
    }

    public update(delta: number): void {
        for (const entity of this.animatedEntities) entity.animate(delta);
    }

    public reset(): void {
        for (const pool of this.pools.values()) {
            for (const entity of pool.getAll()) entity.despawn();
        }
    }
}
