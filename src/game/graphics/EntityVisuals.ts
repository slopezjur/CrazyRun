import * as THREE from 'three/webgpu';
import type { EntityVisual } from '../entities/Entity';
import type { SpawnChoice } from '../SpawnPolicy';
import type { HazardBehavior } from '../entities/Hazard';
import { SwayMotion, GateMotion, CollapseMotion } from './HazardMotion';
import type { PowerUp } from '../PowerUps';
import { MaterialFactory } from './MaterialFactory';

export interface ObstacleDefinition extends SpawnChoice {
    readonly slideClear?: boolean;
    createVisual(): EntityVisual;
}

function box(width: number, height: number, depth: number, color: number): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), MaterialFactory.create(color));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

export const OBSTACLE_DEFINITIONS: readonly ObstacleDefinition[] = [
    {
        id: 'hurdle', weight: 0.35,
        createVisual: () => {
            const mesh = new THREE.Group();
            const hurdle = box(1.3, 0.5, 0.3, 0xffaa00);
            hurdle.position.y = 0.25;
            mesh.add(hurdle);
            return { mesh, collider: hurdle };
        }
    },
    {
        id: 'arch', weight: 0.35, slideClear: true,
        createVisual: () => {
            const mesh = new THREE.Group();
            const beam = box(1.4, 0.5, 0.3, 0xff3366);
            beam.position.y = 1.6;
            mesh.add(beam);
            const postGeometry = new THREE.BoxGeometry(0.12, 1.6, 0.15);
            const postMaterial = MaterialFactory.create(0x888888);
            for (const x of [-0.65, 0.65]) {
                const post = new THREE.Mesh(postGeometry, postMaterial);
                post.position.set(x, 0.8, 0);
                post.castShadow = true;
                mesh.add(post);
            }
            return { mesh, collider: beam };
        }
    },
    {
        id: 'wall', weight: 0.3,
        createVisual: () => {
            const mesh = new THREE.Group();
            const wall = box(1.3, 2, 0.6, 0xff2222);
            wall.position.y = 1;
            mesh.add(wall);
            return { mesh, collider: wall };
        }
    }
];

export function createCoinVisual(): EntityVisual {
    const geometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
    geometry.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, MaterialFactory.create(0xffff00));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return { mesh, yOffset: 1 };
}

export interface HazardDefinition {
    readonly id: string;
    create(): { visual: EntityVisual; behavior: HazardBehavior };
}

function blockVisual(spec: { width: number; height: number; depth: number; color: number; y: number; stripDepth: number; stripY: number }): EntityVisual {
    const mesh = new THREE.Group();
    const collider = box(spec.width, spec.height, spec.depth, spec.color);
    collider.position.y = spec.y;
    mesh.add(collider);
    for (const x of [-0.55, 0.55]) {
        const strip = box(0.08, 0.08, spec.stripDepth, 0xffc857);
        strip.position.set(x, spec.stripY, 0);
        mesh.add(strip);
    }
    return { mesh, collider };
}

export const HAZARD_DEFINITIONS: readonly HazardDefinition[] = [
    ...OBSTACLE_DEFINITIONS.map(definition => ({
        id: definition.id,
        create: () => ({ visual: definition.createVisual(), behavior: { slideClear: definition.slideClear } })
    })),
    {
        id: 'barrier',
        create: () => {
            const visual = blockVisual({ width: 1.1, height: 1.8, depth: 0.6, color: 0xff5577, y: 0.9, stripDepth: 0.7, stripY: 1.85 });
            return { visual, behavior: { motion: new SwayMotion(visual.mesh) } };
        }
    },
    {
        id: 'gate',
        create: () => {
            const visual = OBSTACLE_DEFINITIONS.find(definition => definition.id === 'arch')!.createVisual();
            return { visual, behavior: { slideClear: true, motion: new GateMotion(visual.collider!) } };
        }
    },
    {
        id: 'gap',
        create: () => {
            const visual = blockVisual({ width: 1.3, height: 0.45, depth: 5, color: 0x02040d, y: 0.05, stripDepth: 5, stripY: 0.3 });
            const tile = box(1.15, 0.06, 4.5, 0x536078);
            tile.position.y = 0.32;
            visual.mesh.add(tile);
            return { visual, behavior: { motion: new CollapseMotion(tile) } };
        }
    },
    {
        id: 'convoy',
        create: () => {
            const visual = blockVisual({ width: 1.1, height: 2.2, depth: 4, color: 0x6d4cff, y: 1.1, stripDepth: 0.7, stripY: 1.85 });
            const window = box(0.85, 0.6, 0.05, 0x8fffee);
            window.position.set(0, 1.5, 2.03);
            visual.mesh.add(window);
            return { visual, behavior: { motion: new SwayMotion(visual.mesh) } };
        }
    }
];

export interface PowerVisualDefinition { readonly color: number; geometry(): THREE.BufferGeometry; }
export const POWER_VISUALS: Readonly<Record<PowerUp, PowerVisualDefinition>> = {
    magnet: { color: 0x40dfff, geometry: () => new THREE.TorusGeometry(0.35, 0.13, 8, 16, Math.PI * 1.5) },
    shield: { color: 0x8dffb3, geometry: () => new THREE.IcosahedronGeometry(0.48) },
    slow: { color: 0xc49aff, geometry: () => new THREE.OctahedronGeometry(0.5) }
};

export function createPowerVisual(power: PowerUp, definitions = POWER_VISUALS): EntityVisual {
    const definition = definitions[power];
    if (!definition) throw new RangeError('Unknown power-up visual: ' + power);
    const material = new THREE.MeshStandardNodeMaterial({
        color: definition.color, emissive: definition.color, emissiveIntensity: 0.7, roughness: 0.25
    });
    return { mesh: new THREE.Mesh(definition.geometry(), material), yOffset: 1.25 };
}
