import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export class Chunk {
    public readonly mesh: THREE.Mesh;
    private z = 0;

    /** Lane dashes and edge lines merged into one geometry so each chunk draws them in a single call. */
    public static createMarkings(length: number): THREE.BufferGeometry {
        const parts: THREE.BufferGeometry[] = [];
        for (let offset = -length / 2 + 5; offset < length / 2; offset += 10) {
            parts.push(new THREE.BoxGeometry(0.2, 0.05, 4).translate(0, 0, offset));
        }
        for (const x of [-2.9, 2.9]) parts.push(new THREE.BoxGeometry(0.2, 0.05, length).translate(x, 0, 0));
        const markings = mergeGeometries(parts);
        for (const part of parts) part.dispose();
        if (!markings) throw new Error('Track markings could not be merged.');
        return markings;
    }

    constructor(
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        public readonly length: number,
        markingGeometry: THREE.BufferGeometry,
        markingMaterial: THREE.Material
    ) {
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.receiveShadow = true;
        this.mesh.position.y = -0.25;
        const markings = new THREE.Mesh(markingGeometry, markingMaterial);
        markings.position.y = 0.26;
        this.mesh.add(markings);
    }

    public get zPosition(): number {
        return this.z;
    }

    public setZPosition(z: number): void {
        this.z = z;
        this.mesh.position.z = z;
    }

    public shiftZ(amount: number): void {
        this.setZPosition(this.z + amount);
    }
}
