import * as THREE from 'three/webgpu';
import { Entity } from './Entity';

export class EntityPool<T extends Entity> {
    private pool: T[] = [];

    constructor(
        private scene: THREE.Scene, 
        private size: number, 
        private factory: () => T
    ) {
        for (let i = 0; i < this.size; i++) {
            const entity = this.factory();
            this.scene.add(entity.mesh);
            this.pool.push(entity);
        }
    }

    public getInactive(): T | null {
        return this.pool.find(e => !e.isActive) || null;
    }

    public getAll(): T[] {
        return this.pool;
    }
}
