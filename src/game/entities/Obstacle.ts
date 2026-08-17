import * as THREE from 'three/webgpu';
import { Entity } from './Entity';
import { MaterialFactory } from '../graphics/MaterialFactory';

export class Obstacle extends Entity {
    constructor() {
        const geometry = new THREE.BoxGeometry(1, 1.5, 1);
        const nodeMat = MaterialFactory.createCurvedMaterial(0xff0000);
        super(geometry, nodeMat);
    }

    public get isSolid(): boolean {
        return true;
    }

    public spawn(x: number, y: number, z: number): void {
        // Y offset so bottom touches floor (assuming floor Y=0)
        super.spawn(x, y + 0.75, z);
    }

    public animate(_deltaTime: number): void {
        // Obstacles don't animate natively
    }
}
