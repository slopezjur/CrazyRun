import type { Box3 } from 'three';

export interface IBoundingVolume {
    readonly boundingBox: Box3;
    readonly z: number;
}

export type CollisionResponse = 'continue' | 'stop';

export interface ICollisionTarget extends IBoundingVolume {
    readonly isActive: boolean;
    onCollide(): CollisionResponse;
}

export interface ICollisionSource {
    forEachActive(visitor: (target: ICollisionTarget) => boolean): void;
}

export class CollisionManager {
    constructor(
        private readonly subject: IBoundingVolume,
        private readonly targets: ICollisionSource,
        private readonly zGate = 2
    ) {}

    private readonly checkTarget = (target: ICollisionTarget): boolean => {
        if (!target.isActive) return true;
        if (Math.abs(target.z - this.subject.z) > this.zGate
            && (target.boundingBox.min.z > this.subject.boundingBox.max.z
                || target.boundingBox.max.z < this.subject.boundingBox.min.z)) return true;
        if (!this.subject.boundingBox.intersectsBox(target.boundingBox)) return true;
        return target.onCollide() !== 'stop';
    };

    public checkCollisions(): void {
        this.targets.forEachActive(this.checkTarget);
    }
}
