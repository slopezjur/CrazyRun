import * as THREE from 'three/webgpu';
import { Chunk } from '../Chunk';

/** Lights the scene; WorldEnvironment owns the biome sky colour and fog. */
export function configureEnvironment(scene: THREE.Scene): void {
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 5);
    light.castShadow = true;
    // Light-space bounds of the shadow casters, from just behind the player (z = 12)
    // to the start of the fog (z ≈ -140), across the track width and jump height.
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 200;
    light.shadow.camera.left = -12;
    light.shadow.camera.right = 100;
    light.shadow.camera.top = 95;
    light.shadow.camera.bottom = -10;
    scene.add(light);
}

export function createTrackChunks(scene: THREE.Scene, length = 30, count = 40): Chunk[] {
    const geometry = new THREE.BoxGeometry(6, 0.5, length);
    const material = new THREE.MeshStandardNodeMaterial({ color: 0x404040, roughness: 0.8 });
    const markings = Chunk.createMarkings(length);
    const markingMaterial = new THREE.MeshStandardNodeMaterial({
        color: 0xffffff, roughness: 0.4, emissive: 0x222222
    });
    const chunks: Chunk[] = [];
    for (let i = 0; i < count; i++) {
        const chunk = new Chunk(geometry, material, length, markings, markingMaterial);
        scene.add(chunk.mesh);
        chunks.push(chunk);
    }
    return chunks;
}
