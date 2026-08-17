import * as THREE from 'three/webgpu';
import { worldCurveNode } from '../shaders/WorldCurve';

export class MaterialFactory {
    /**
     * Creates a MeshStandardNodeMaterial pre-configured with the WorldCurve shader.
     */
    public static createCurvedMaterial(color: number | THREE.Color): THREE.MeshStandardNodeMaterial {
        const nodeMat = new THREE.MeshStandardNodeMaterial({ color });
        // nodeMat.positionNode = worldCurveNode(); // Disabled for a plain flat road
        return nodeMat;
    }

    /**
     * Upgrades an existing standard material to a curved node material.
     * Useful when migrating materials loaded from a .glb file.
     */
    public static upgradeToCurvedMaterial(baseMaterial: THREE.Material): THREE.MeshStandardNodeMaterial {
        const color = (baseMaterial as THREE.MeshStandardMaterial).color || 0xffffff;
        return this.createCurvedMaterial(color);
    }
}
