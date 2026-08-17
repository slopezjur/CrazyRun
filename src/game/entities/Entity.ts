import * as THREE from 'three/webgpu';

export abstract class Entity {
    public mesh: THREE.Mesh;
    public isActive: boolean = false;
    public boundingBox: THREE.Box3 = new THREE.Box3();

    constructor(geometry: THREE.BufferGeometry, material: THREE.NodeMaterial) {
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.visible = false;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
    }

    public abstract get isSolid(): boolean;

    public get z(): number {
        return this.mesh.position.z;
    }

    public onCollide(): void {
        if (!this.isSolid) {
            this.despawn(); // Automatically despawn triggers (coins)
        }
    }

    public spawn(x: number, y: number, z: number): void {
        this.mesh.position.set(x, y, z);
        this.isActive = true;
        this.mesh.visible = true;
        this.syncBounds();
    }

    public despawn(): void {
        this.isActive = false;
        this.mesh.visible = false;
    }

    public scroll(amount: number): void {
        if (this.isActive) {
            this.mesh.position.z += amount;
            this.syncBounds();
        }
    }

    public syncBounds(): void {
        if (!this.isActive) return;
        this.boundingBox.setFromObject(this.mesh);
    }

    public abstract animate(deltaTime: number): void;
}
