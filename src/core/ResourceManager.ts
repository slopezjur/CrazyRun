import * as THREE from 'three/webgpu';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class ResourceManager {
    private static gltfLoader = new GLTFLoader();

    public static async loadModel(url: string): Promise<GLTF | null> {
        return new Promise((resolve) => {
            this.gltfLoader.load(
                url,
                (gltf) => resolve(gltf),
                undefined,
                (error) => {
                    console.warn(`Failed to load model from ${url}:`, error);
                    resolve(null);
                }
            );
        });
    }
    public static dispose(object: THREE.Object3D): void {
        object.traverse((child: any) => {
            if (child.isMesh || child.isPoints || child.isLine) {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach((mat: any) => this.disposeMaterial(mat));
                    } else {
                        this.disposeMaterial(child.material);
                    }
                }
            }
        });
    }

    private static disposeMaterial(material: any): void {
        if (material.map) material.map.dispose();
        if (material.lightMap) material.lightMap.dispose();
        if (material.bumpMap) material.bumpMap.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.specularMap) material.specularMap.dispose();
        if (material.envMap) material.envMap.dispose();
        material.dispose();
    }
}
