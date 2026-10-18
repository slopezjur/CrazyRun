import { Box3, type Object3D } from 'three';
import type { CollisionResponse, ICollisionTarget } from '../CollisionManager';
import type { SpawnData } from '../SpawnPolicy';

export interface EntityVisual {
    readonly mesh: Object3D;
    readonly collider?: Object3D;
    readonly yOffset?: number;
}

export interface IAnimatedEntity {
    animate(delta: number): void;
}

export interface IManagedEntity extends ICollisionTarget {
    spawn(x: number, y: number, z: number, data?: SpawnData): void;
    scroll(amount: number): void;
    expire(): void;
    despawn(): void;
}

export abstract class Entity implements IManagedEntity {
    private metadata: SpawnData = {};
    public readonly mesh: Object3D;
    public readonly boundingBox = new Box3();
    private active = false;
    private readonly collider: Object3D;
    private readonly yOffset: number;

    constructor(visual: EntityVisual) {
        this.mesh = visual.mesh;
        this.collider = visual.collider ?? visual.mesh;
        this.yOffset = visual.yOffset ?? 0;
        this.mesh.visible = false;
    }

    public get spawnData(): SpawnData { return this.metadata; }
    public get position(): Readonly<{ x: number; y: number; z: number }> { return this.mesh.position; }

    public get isActive(): boolean {
        return this.active;
    }

    public get z(): number {
        return this.mesh.position.z;
    }

    public abstract onCollide(): CollisionResponse;

    public spawn(x: number, y: number, z: number, data: SpawnData = {}): void {
        this.metadata = data;
        this.mesh.position.set(x, y + this.yOffset, z);
        this.active = true;
        this.mesh.visible = true;
        this.syncBounds();
    }

    public despawn(): void {
        this.active = false;
        this.mesh.visible = false;
    }

    public expire(): void { this.despawn(); }

    public scroll(amount: number): void {
        if (!this.active) return;
        this.mesh.position.z += amount;
        this.syncBounds();
    }

    public syncBounds(): void {
        if (!this.active) return;
        this.mesh.updateWorldMatrix(true, true);
        this.boundingBox.setFromObject(this.collider);
    }
}
