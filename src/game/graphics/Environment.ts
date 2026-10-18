import * as THREE from 'three/webgpu';
import { Chunk } from '../Chunk';

export function configureEnvironment(scene: THREE.Scene): void {
    const skyColor = 0x202020;
    scene.background = new THREE.Color(skyColor);
    scene.fog = new THREE.Fog(skyColor, 100, 300);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 5);
    light.castShadow = true;
    light.shadow.mapSize.set(4096, 4096);
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 600;
    light.shadow.camera.left = -90;
    light.shadow.camera.right = 90;
    light.shadow.camera.top = 450;
    light.shadow.camera.bottom = -150;
    scene.add(light);
}

export function createTrackChunks(scene: THREE.Scene, length = 30, count = 40): Chunk[] {
    const geometry = new THREE.BoxGeometry(6, 0.5, length);
    const material = new THREE.MeshStandardNodeMaterial({ color: 0x404040, roughness: 0.8 });
    const lineGeometry = new THREE.BoxGeometry(0.2, 0.05, 4);
    const sideGeometry = new THREE.BoxGeometry(0.2, 0.05, length);
    const lineMaterial = new THREE.MeshStandardNodeMaterial({
        color: 0xffffff, roughness: 0.4, emissive: 0x222222
    });
    const chunks: Chunk[] = [];
    for (let i = 0; i < count; i++) {
        const chunk = new Chunk(geometry, material, length, lineGeometry, lineMaterial, sideGeometry);
        scene.add(chunk.mesh);
        chunks.push(chunk);
    }
    return chunks;
}
