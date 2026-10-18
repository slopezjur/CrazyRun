import * as THREE from 'three/webgpu';

export class MaterialFactory {
    public static create(color: number | THREE.Color): THREE.MeshStandardNodeMaterial {
        return new THREE.MeshStandardNodeMaterial({ color });
    }

    public static convert(material: THREE.Material): THREE.NodeMaterial {
        return THREE.NodeMaterial.fromMaterial(material);
    }
}
