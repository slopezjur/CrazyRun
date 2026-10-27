import * as THREE from 'three/webgpu';

export class MaterialFactory {
    // The same material-to-node-material mapping WebGPURenderer applies to non-node materials.
    private static readonly library = new THREE.StandardNodeLibrary();

    public static create(color: number | THREE.Color): THREE.MeshStandardNodeMaterial {
        return new THREE.MeshStandardNodeMaterial({ color });
    }

    public static convert(material: THREE.Material): THREE.NodeMaterial {
        // fromMaterial returns null for unsupported materials despite its declared type.
        const converted: THREE.NodeMaterial | null = MaterialFactory.library.fromMaterial(material);
        if (!converted) throw new Error(`Material "${material.type}" is not compatible.`);
        return converted;
    }
}
