import * as THREE from 'three/webgpu';
import { MaterialFactory } from './graphics/MaterialFactory';

export class Chunk {
    public mesh: THREE.Mesh;
    public isActive: boolean = true;
    public zPosition: number = 0;

    constructor(
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        public readonly length: number,
        lineGeometry?: THREE.BufferGeometry,
        lineMaterial?: THREE.Material,
        sideLineGeometry?: THREE.BufferGeometry
    ) {
        const nodeMat = MaterialFactory.upgradeToCurvedMaterial(material);

        this.mesh = new THREE.Mesh(geometry, nodeMat);
        this.mesh.receiveShadow = true;
        this.mesh.position.y = -0.25; // Top surface at y=0 if thickness is 0.5

        if (lineGeometry && lineMaterial) {
            const lineNodeMat = MaterialFactory.upgradeToCurvedMaterial(lineMaterial);
            
            // Middle dashed line (separates the two channels)
            const lineOffsets = [-10, 0, 10];
            for (const zOffset of lineOffsets) {
                const middleLine = new THREE.Mesh(lineGeometry, lineNodeMat);
                middleLine.position.set(0, 0.26, zOffset);
                this.mesh.add(middleLine);
            }
            
            // Continuous side lines
            if (sideLineGeometry) {
                const leftSideLine = new THREE.Mesh(sideLineGeometry, lineNodeMat);
                leftSideLine.position.set(-2.9, 0.26, 0);
                this.mesh.add(leftSideLine);
                
                const rightSideLine = new THREE.Mesh(sideLineGeometry, lineNodeMat);
                rightSideLine.position.set(2.9, 0.26, 0);
                this.mesh.add(rightSideLine);
            }
        }
    }

    public setZPosition(z: number): void {
        this.zPosition = z;
        this.mesh.position.z = z;
    }

    public shiftZ(amount: number): void {
        this.zPosition += amount;
        this.mesh.position.z = this.zPosition;
    }

    public reset(): void {
        this.isActive = true;
        // Future: Reset obstacles/coins associated with this chunk
    }
}
