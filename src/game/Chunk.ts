import * as THREE from 'three/webgpu';

export class Chunk {
    public readonly mesh: THREE.Mesh;
    private z = 0;

    constructor(
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        public readonly length: number,
        lineGeometry: THREE.BufferGeometry,
        lineMaterial: THREE.Material,
        sideLineGeometry: THREE.BufferGeometry
    ) {
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.receiveShadow = true;
        this.mesh.position.y = -0.25;
        for (let offset = -length / 2 + 5; offset < length / 2; offset += 10) {
            const line = new THREE.Mesh(lineGeometry, lineMaterial);
            line.position.set(0, 0.26, offset);
            this.mesh.add(line);
        }
        for (const x of [-2.9, 2.9]) {
            const line = new THREE.Mesh(sideLineGeometry, lineMaterial);
            line.position.set(x, 0.26, 0);
            this.mesh.add(line);
        }
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
