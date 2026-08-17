import * as THREE from 'three/webgpu';
import { Chunk } from './Chunk';

export class ChunkManager {
    private chunks: Chunk[] = [];
    
    private readonly chunkLength = 30;
    private readonly poolSize = 40;
    private readonly laneWidth = 3;

    public onChunkRecycled?: (chunkZ: number) => void;

    constructor(private scene: THREE.Scene) {
        this.initializePool();
    }

    private initializePool(): void {
        const geometry = new THREE.BoxGeometry(6, 0.5, this.chunkLength);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x404040, roughness: 0.8 });
        const lineGeo = new THREE.BoxGeometry(0.2, 0.05, 4);
        const sideLineGeo = new THREE.BoxGeometry(0.2, 0.05, this.chunkLength);
        const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, emissive: 0x222222 });

        for (let i = 0; i < this.poolSize; i++) {
            const chunk = new Chunk(geometry, groundMat, this.chunkLength, lineGeo, lineMat, sideLineGeo);
            
            const zPos = -i * this.chunkLength;
            chunk.setZPosition(zPos);
            
            this.scene.add(chunk.mesh);
            this.chunks.push(chunk);
        }
    }

    public updatePooling(referenceZ: number): void {
        const oldestChunk = this.chunks[0];
        const safeDistanceBehindCamera = referenceZ + this.chunkLength;

        if (oldestChunk.zPosition > safeDistanceBehindCamera) {
            this.chunks.shift(); 
            
            const furthestChunk = this.chunks[this.chunks.length - 1];
            const newZ = furthestChunk.zPosition - this.chunkLength;
            
            oldestChunk.setZPosition(newZ);
            oldestChunk.reset();
            
            if (this.onChunkRecycled) {
                this.onChunkRecycled(newZ);
            }
            
            this.chunks.push(oldestChunk);
        }
    }

    public shiftAll(amount: number): void {
        for (const chunk of this.chunks) {
            chunk.shiftZ(amount);
        }
    }

    public scroll(amount: number): void {
        // Move all chunks towards +Z (towards the player)
        this.shiftAll(amount);
    }
    
    public reset(): void {
        for (let i = 0; i < this.chunks.length; i++) {
            const zPos = -i * this.chunkLength;
            this.chunks[i].setZPosition(zPos);
            this.chunks[i].reset();
        }
    }
}
