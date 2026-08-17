import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

export class AssetManager {
    private loader: GLTFLoader;
    private cache: Map<string, THREE.Object3D> = new Map();

    constructor(renderer?: THREE.WebGPURenderer) {
        this.loader = new GLTFLoader();
        
        // Setup Draco
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        this.loader.setDRACOLoader(dracoLoader);
        
        // Setup KTX2
        if (renderer) {
            const ktx2Loader = new KTX2Loader();
            ktx2Loader.setTranscoderPath('https://unpkg.com/three@0.167.0/examples/jsm/libs/basis/');
            ktx2Loader.detectSupport(renderer);
            this.loader.setKTX2Loader(ktx2Loader);
        }
    }

    public async loadModel(url: string, fallback: THREE.Object3D): Promise<THREE.Object3D> {
        if (this.cache.has(url)) {
            return this.cache.get(url)!.clone();
        }

        try {
            const gltf = await this.loader.loadAsync(url);
            const model = gltf.scene;
            
            // Enable shadows on all loaded meshes
            model.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            this.cache.set(url, model);
            return model.clone();
        } catch (error) {
            console.warn(`[AssetManager] Failed to load ${url}, using fallback primitive.`, error);
            return fallback.clone();
        }
    }
    
    public createLODWrapper(highDetail: THREE.Object3D, lowDetail: THREE.Object3D, distance: number = 30): THREE.LOD {
        const lod = new THREE.LOD();
        lod.addLevel(highDetail, 0);
        lod.addLevel(lowDetail, distance);
        return lod;
    }
}
