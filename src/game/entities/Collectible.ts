import * as THREE from 'three/webgpu';
import { Entity } from './Entity';
import { MaterialFactory } from '../graphics/MaterialFactory';

export class Collectible extends Entity {
    constructor() {
        const geometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
        geometry.rotateX(Math.PI / 2); // Rotate to stand like a coin
        const nodeMat = MaterialFactory.createCurvedMaterial(0xffff00);
        super(geometry, nodeMat);
    }

    public get isSolid(): boolean {
        return false;
    }

    public spawn(x: number, y: number, z: number): void {
        // Float slightly above the ground
        super.spawn(x, y + 1.0, z);
    }

    public animate(deltaTime: number): void {
        if (this.isActive) {
            this.mesh.rotation.y += 3.0 * deltaTime;
            this.syncBounds();
        }
    }
}
