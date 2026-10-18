import * as THREE from 'three/webgpu';
import { MaterialFactory } from './MaterialFactory';

export interface CharacterVisual {
    readonly id: string;
    create(): THREE.Mesh;
}

export const CHARACTER_VISUALS: readonly CharacterVisual[] = [
    { id: 'runner', create: () => new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1, 4, 16), MaterialFactory.create(0x00ff00)) },
    {
        id: 'robot',
        create: () => {
            const robot = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.65, 0.75), MaterialFactory.create(0x00ff88));
            const visor = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.22, 0.08), MaterialFactory.create(0x13233c));
            visor.position.set(0, 0.4, -0.41);
            robot.add(visor);
            return robot;
        }
    },
    {
        id: 'comet',
        create: () => {
            const comet = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), MaterialFactory.create(0x00ff88));
            comet.scale.y = 1.25;
            return comet;
        }
    }
];
export const OUTFIT_COLORS: ReadonlyMap<string, number> = new Map([
    ['lime', 0x55ffc1], ['violet', 0xbb8bff], ['sunset', 0xff9464]
]);
export const TRAIL_COLORS: ReadonlyMap<string, number> = new Map([
    ['none', 0xffd66b], ['cyan', 0x50eaff], ['gold', 0xffd66b]
]);
