import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface IModelLoader {
    loadModel(url: string): Promise<GLTF | null>;
}

export class AssetManager implements IModelLoader {
    constructor(
        private readonly loader: { loadAsync(url: string): Promise<GLTF> },
        private readonly onError: (url: string, error: unknown) => void
    ) {}

    public async loadModel(url: string): Promise<GLTF | null> {
        try {
            return await this.loader.loadAsync(url);
        } catch (error) {
            this.onError(url, error);
            return null;
        }
    }
}
