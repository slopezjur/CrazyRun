import * as THREE from 'three/webgpu';
import { Entity } from './Entity';
import { MaterialFactory } from '../graphics/MaterialFactory';

export enum ObstacleType {
    LowHurdle,  // Must jump over
    HighArch,   // Must slide under
    FullWall    // Must change lanes
}

export class Obstacle extends Entity {
    private hurdleMesh: THREE.Mesh;
    private beamMesh: THREE.Mesh;
    private archGroup: THREE.Group;
    private wallMesh: THREE.Mesh;
    public currentType: ObstacleType = ObstacleType.FullWall;

    constructor() {
        const rootGroup = new THREE.Group();

        // 1. Low Hurdle (Height 0.6 on ground -> must jump)
        const hurdleGeo = new THREE.BoxGeometry(1.3, 0.5, 0.3);
        const hurdleMat = MaterialFactory.createCurvedMaterial(0xffaa00);
        const hurdleMesh = new THREE.Mesh(hurdleGeo, hurdleMat);
        hurdleMesh.position.set(0, 0.25, 0);
        hurdleMesh.castShadow = true;
        hurdleMesh.receiveShadow = true;
        rootGroup.add(hurdleMesh);

        // 2. High Arch (Overhead beam at Y: 1.3 - 1.9, gap from 0 to 1.3 -> must slide)
        const archGroup = new THREE.Group();
        const beamGeo = new THREE.BoxGeometry(1.4, 0.5, 0.3);
        const archMat = MaterialFactory.createCurvedMaterial(0xff3366);
        const beamMesh = new THREE.Mesh(beamGeo, archMat);
        beamMesh.position.set(0, 1.6, 0); // Top clearance
        beamMesh.castShadow = true;
        beamMesh.receiveShadow = true;
        archGroup.add(beamMesh);

        // Side posts for visual clarity
        const postGeo = new THREE.BoxGeometry(0.12, 1.6, 0.15);
        const postMat = MaterialFactory.createCurvedMaterial(0x888888);
        const leftPost = new THREE.Mesh(postGeo, postMat);
        leftPost.position.set(-0.65, 0.8, 0);
        leftPost.castShadow = true;
        archGroup.add(leftPost);

        const rightPost = new THREE.Mesh(postGeo, postMat);
        rightPost.position.set(0.65, 0.8, 0);
        rightPost.castShadow = true;
        archGroup.add(rightPost);

        rootGroup.add(archGroup);

        // 3. Full Wall (Height 2.0 -> must dodge)
        const wallGeo = new THREE.BoxGeometry(1.3, 2.0, 0.6);
        const wallMat = MaterialFactory.createCurvedMaterial(0xff2222);
        const wallMesh = new THREE.Mesh(wallGeo, wallMat);
        wallMesh.position.set(0, 1.0, 0);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        rootGroup.add(wallMesh);

        super(rootGroup);

        this.hurdleMesh = hurdleMesh;
        this.beamMesh = beamMesh;
        this.archGroup = archGroup;
        this.wallMesh = wallMesh;
    }

    public get isSolid(): boolean {
        return true;
    }

    public spawn(x: number, y: number, z: number, type: ObstacleType = ObstacleType.FullWall): void {
        this.currentType = type;

        // Toggle visibility of the specific obstacle variation
        this.hurdleMesh.visible = type === ObstacleType.LowHurdle;
        this.archGroup.visible = type === ObstacleType.HighArch;
        this.wallMesh.visible = type === ObstacleType.FullWall;

        super.spawn(x, y, z);
    }

    public override syncBounds(): void {
        if (!this.isActive) return;

        // Calculate precision collision box based on active obstacle sub-component
        switch (this.currentType) {
            case ObstacleType.HighArch:
                // Only the overhead beam is collidable, allowing clean sliding underneath
                this.boundingBox.setFromObject(this.beamMesh);
                break;
            case ObstacleType.LowHurdle:
                this.boundingBox.setFromObject(this.hurdleMesh);
                break;
            case ObstacleType.FullWall:
            default:
                this.boundingBox.setFromObject(this.wallMesh);
                break;
        }
    }

    public animate(_deltaTime: number): void {
        // Obstacles are static
    }
}
