import { Entity, type EntityVisual, type IAnimatedEntity } from './Entity';
import type { CollisionResponse } from '../CollisionManager';
import type { SpawnData } from '../SpawnPolicy';

export class Collectible extends Entity implements IAnimatedEntity {
    constructor(visual: EntityVisual, private readonly onCollected: (entity: Collectible) => void,
        private readonly onMissed?: (entity: Collectible) => void) {
        super(visual);
    }

    public override spawn(x: number, y: number, z: number, data?: SpawnData): void {
        this.mesh.rotation.set(0, 0, 0);
        super.spawn(x, y, z, data);
    }

    public onCollide(): CollisionResponse {
        if (this.isActive) {
            this.despawn();
            this.onCollected(this);
        }
        return 'continue';
    }

    public override expire(): void {
        if (this.isActive) this.onMissed?.(this);
        super.expire();
    }

    public attractTo(x: number, y: number, fraction: number): void {
        if (!this.isActive) return;
        this.mesh.position.x += (x - this.mesh.position.x) * fraction;
        this.mesh.position.y += (y - this.mesh.position.y) * fraction;
        this.syncBounds();
    }

    public animate(delta: number): void {
        if (!this.isActive) return;
        this.mesh.rotation.y += 3 * delta;
        this.syncBounds();
    }
}
