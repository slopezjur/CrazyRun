import type { Object3D } from 'three';
import type { IHazardMotion } from '../entities/Hazard';

export class SwayMotion implements IHazardMotion {
    private laneX = 0;
    private phase = 0;
    constructor(private readonly target: Object3D) {}
    public reset(laneX: number, phase: number): void { this.laneX = laneX; this.phase = phase; }
    public update(time: number): void { this.target.position.x = this.laneX + Math.sin(time * 2 + this.phase) * 0.22; }
}

export class GateMotion implements IHazardMotion {
    private phase = 0;
    constructor(private readonly beam: Object3D) {}
    public reset(_laneX: number, phase: number): void { this.phase = phase; }
    public update(time: number): void { this.beam.position.y = 1.6 + (Math.sin(time * 2 + this.phase) + 1) * 0.65; }
}

export class CollapseMotion implements IHazardMotion {
    constructor(private readonly tile: Object3D) {}
    public update(_time: number, z: number): void {
        const fall = Math.max(0, Math.min(1, (z + 45) / 25));
        this.tile.position.y = 0.32 - fall * 4;
        this.tile.rotation.x = fall * 0.6;
    }
}
