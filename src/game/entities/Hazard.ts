import type { Box3 } from 'three';
import type { CollisionResponse } from '../CollisionManager';
import type { SpawnData } from '../SpawnPolicy';
import { Entity, type EntityVisual } from './Entity';

export interface IHazardMotion {
    reset?(laneX: number, phase: number): void;
    update(time: number, z: number): void;
}
export interface HazardBehavior {
    readonly slideClear?: boolean;
    readonly motion?: IHazardMotion;
}

export class Hazard extends Entity {
    private passed = false;
    private engaged = false;
    private close = false;
    private slidUnder = false;

    constructor(
        visual: EntityVisual,
        private readonly behavior: HazardBehavior,
        private readonly hit: (hazard: Hazard) => CollisionResponse,
        private readonly cleared: (arch: boolean, near: boolean) => void
    ) { super(visual); }

    public override spawn(x: number, y: number, z: number, data?: SpawnData): void {
        super.spawn(x, y, z, data);
        this.passed = this.engaged = this.close = this.slidUnder = false;
        this.behavior.motion?.reset?.(x, this.spawnData.phase ?? 0);
        this.simulate(0);
    }

    public simulate(time: number): void {
        // Static hazards keep the bounds measured at spawn; scrolling translates them.
        if (!this.isActive || !this.behavior.motion) return;
        this.behavior.motion.update(time, this.z);
        this.syncBounds();
    }

    public observe(box: Box3, x: number, sliding: boolean): void {
        if (!this.isActive || this.passed) return;
        if (Math.abs(this.z) < 2) {
            const dx = Math.max(0, box.min.x - this.boundingBox.max.x, this.boundingBox.min.x - box.max.x);
            const dy = Math.max(0, box.min.y - this.boundingBox.max.y, this.boundingBox.min.y - box.max.y);
            const clearance = Math.hypot(dx, dy);
            this.close ||= clearance > 0 && clearance < 0.32;
            this.engaged ||= Math.abs(x - this.position.x) < 0.8;
            this.slidUnder ||= sliding && Math.abs(x - this.position.x) < 0.6;
        }
        if (this.boundingBox.min.z > box.max.z + 0.1) {
            this.passed = true;
            if (this.engaged || this.close) this.cleared(this.slidUnder && this.behavior.slideClear === true, this.close);
        }
    }

    public onCollide(): CollisionResponse { return this.isActive ? this.hit(this) : 'continue'; }
}
