import * as THREE from 'three/webgpu';

export interface IBoundingVolume {
    boundingBox: THREE.Box3;
    z: number;
}

export interface ICollisionTarget extends IBoundingVolume {
    isSolid: boolean;
    onCollide(): void;
}

export class CollisionManager {
    // Narrow Z-gate: Only check entities extremely close to the player on Z
    private readonly zGate: number = 2.0;

    constructor(
        private subject: IBoundingVolume, 
        private getTargets: () => ICollisionTarget[],
        public onCrash?: () => void,
        public onCoinCollected?: (coin: any) => void
    ) {}

    public checkCollisions(): void {
        const subjectZ = this.subject.z;
        const subjectBox = this.subject.boundingBox;

        // Iterate over all active target entities provided by the getter
        for (const target of this.getTargets()) {
            
            // 1. Broad Phase: Z-Gated Proximity Check
            if (Math.abs(target.z - subjectZ) > this.zGate) {
                continue; // Skip entities outside the Z-gate
            }

            // 2. Narrow Phase: Precise AABB Intersection
            if (subjectBox.intersectsBox(target.boundingBox)) {
                
                // 3. Resolution Delegation
                target.onCollide();
                
                if (target.isSolid) {
                    if (this.onCrash) this.onCrash();
                } else {
                    if (this.onCoinCollected) this.onCoinCollected(target);
                }
            }
        }
    }
}
