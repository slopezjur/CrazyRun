import type * as THREE from 'three';

export interface IResourceDisposer {
    dispose(object: THREE.Object3D): void;
}

interface ResourceObject extends THREE.Object3D {
    geometry?: THREE.BufferGeometry;
    material?: THREE.Material | THREE.Material[];
    skeleton?: THREE.Skeleton;
    isLight?: boolean;
}

export class ResourceManager implements IResourceDisposer {
    private readonly disposed = new WeakSet<object>();

    public dispose(object: THREE.Object3D): void {
        object.traverse(child => {
            const resource = child as ResourceObject;
            if (resource.geometry) this.release(resource.geometry);
            if (resource.material) {
                const materials = Array.isArray(resource.material) ? resource.material : [resource.material];
                for (const material of materials) {
                    for (const value of Object.values(material)) {
                        if (this.isTexture(value)) this.release(value);
                    }
                    this.release(material);
                }
            }
            if (resource.skeleton) this.release(resource.skeleton);
            if (resource.isLight) this.release(child as THREE.Light);
        });
    }

    private isTexture(value: unknown): value is THREE.Texture {
        return typeof value === 'object' && value !== null
            && 'isTexture' in value && value.isTexture === true;
    }

    private release(resource: { dispose(): void }): void {
        if (this.disposed.has(resource)) return;
        this.disposed.add(resource);
        resource.dispose();
    }
}
