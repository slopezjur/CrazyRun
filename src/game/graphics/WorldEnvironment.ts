import * as THREE from 'three/webgpu';
import type { Biome } from '../Challenge';

const PALETTES = {
    city: { sky: 0x071423, road: 0x162b3d, accent: 0x35f2cf, skylineY: 0, tunnel: false },
    tunnel: { sky: 0x130e24, road: 0x30273e, accent: 0xffbd69, skylineY: 0, tunnel: true },
    rooftops: { sky: 0x182844, road: 0x303b52, accent: 0xdb9dff, skylineY: -8, tunnel: false }
};

export class WorldEnvironment {
    private readonly skyline: THREE.Group;
    private readonly portals: THREE.Group;
    private readonly chaser: THREE.Group;
    private readonly accent = new THREE.MeshStandardNodeMaterial({ emissiveIntensity: 0.7 });
    private readonly sky = new THREE.Color(PALETTES.city.sky);
    private readonly targetSky = new THREE.Color();
    private readonly roadColor = new THREE.Color();

    constructor(scene: THREE.Scene, private readonly road: THREE.MeshStandardNodeMaterial) {
        this.skyline = new THREE.Group();
        this.portals = new THREE.Group();
        this.chaser = new THREE.Group();
        scene.add(this.skyline, this.portals, this.chaser);
        const stone = new THREE.MeshStandardNodeMaterial({ color: 0x23374c, roughness: 0.85 });
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        for (let index = 0; index < 32; index++) {
            const building = new THREE.Group();
            const height = 6 + (index * 13 % 19);
            const body = new THREE.Mesh(geometry, stone);
            body.scale.set(4, height, 7);
            body.position.y = height / 2 - 3;
            building.add(body);
            const stripe = new THREE.Mesh(geometry, this.accent);
            stripe.scale.set(0.08, height * 0.75, 7.1);
            stripe.position.set(index % 2 === 0 ? 2.05 : -2.05, height / 2 - 3, 0);
            building.add(stripe);
            building.position.x = (index % 2 === 0 ? -1 : 1) * (7 + index % 3 * 2);
            this.skyline.add(building);
        }
        for (let index = 0; index < 8; index++) {
            const frame = new THREE.Group();
            for (const x of [-4, 4]) {
                const pillar = new THREE.Mesh(geometry, stone);
                pillar.scale.set(0.35, 7, 0.5);
                pillar.position.set(x, 3.5, 0);
                frame.add(pillar);
            }
            const beam = new THREE.Mesh(geometry, this.accent);
            beam.scale.set(8.4, 0.22, 0.5);
            beam.position.y = 7;
            frame.add(beam);
            this.portals.add(frame);
        }
        const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 0), stone);
        body.scale.set(2, 0.7, 1);
        this.chaser.add(body);
        for (const x of [-1.8, 1.8]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), this.accent);
            eye.position.set(x, 0, 1.1);
            this.chaser.add(eye);
        }
        this.chaser.position.set(0, 6, -45);
        this.chaser.visible = false;
        scene.background = this.sky;
        scene.fog = new THREE.Fog(this.sky, 90, 320);
        this.scene = scene;
    }

    private readonly scene: THREE.Scene;

    public update(delta: number, distance: number, biome: Biome, spectacle: string, motion: number): void {
        const palette = PALETTES[biome];
        const blend = Math.min(1, delta * 2);
        this.sky.lerp(this.targetSky.setHex(palette.sky), blend);
        this.roadColor.setHex(palette.road);
        this.road.color.lerp(this.roadColor, blend);
        this.accent.color.setHex(palette.accent);
        this.accent.emissive.setHex(palette.accent);
        (this.scene.fog as THREE.Fog).color.copy(this.sky);
        this.skyline.children.forEach((building, index) => {
            building.position.z = 30 - ((index * 23 - distance) % 360 + 360) % 360;
            building.position.y = palette.skylineY;
        });
        this.portals.visible = palette.tunnel;
        this.portals.children.forEach((frame, index) => {
            frame.position.z = 20 - ((index * 40 - distance) % 320 + 320) % 320;
        });
        this.chaser.visible = spectacle !== 'none';
        this.chaser.position.y = 6 + Math.sin(distance * 0.025) * 0.4 * motion;
        this.chaser.rotation.z = Math.sin(distance * 0.018) * 0.12 * motion;
    }
}
