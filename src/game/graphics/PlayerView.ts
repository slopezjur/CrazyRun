import * as THREE from 'three/webgpu';
import type { IModelLoader } from '../../core/AssetManager';
import type { IResourceDisposer } from '../../core/ResourceManager';
import type { IPlayerPresentation, PlayerAnimation, PlayerPose } from '../PlayerPresentation';
import { AnimationController } from './AnimationController';
import { MaterialFactory } from './MaterialFactory';
import type { Appearance } from '../ProgressionRules';
import { CHARACTER_VISUALS, OUTFIT_COLORS, type CharacterVisual } from './CosmeticVisuals';

function animationName(name: string): string {
    const normalized = name.toLowerCase();
    if (normalized.includes('run')) return 'Run';
    if (normalized.includes('jump')) return 'Jump';
    if (normalized.includes('slide')) return 'Slide';
    if (normalized.includes('die') || normalized.includes('fall')) return 'Die';
    return name;
}

export class PlayerView implements IPlayerPresentation {
    public readonly mesh = new THREE.Group();
    private readonly animations = new AnimationController();
    private readonly fallback: THREE.Mesh;
    private readonly characters = new Map<string, THREE.Mesh>();
    private model: THREE.Object3D | null = null;
    private appearance: Readonly<Appearance> = { character: 'runner', outfit: 'lime', trail: 'none' };
    private animation: PlayerAnimation = 'Run';
    private speed = 30;
    private disposed = false;

    constructor(
        private readonly resources: IResourceDisposer,
        characters: readonly CharacterVisual[] = CHARACTER_VISUALS,
        private readonly outfitColors: ReadonlyMap<string, number> = OUTFIT_COLORS
    ) {
        for (const definition of characters) {
            if (this.characters.has(definition.id)) throw new Error('Duplicate character: ' + definition.id);
            const mesh = definition.create();
            mesh.visible = definition.id === 'runner';
            this.characters.set(definition.id, mesh);
            this.mesh.add(mesh);
        }
        const fallback = this.characters.get('runner');
        if (!fallback) throw new Error('The runner fallback is required.');
        this.fallback = fallback;
        this.fallback.castShadow = true;
        this.fallback.receiveShadow = true;
    }

    public async loadCharacter(loader: IModelLoader, url: string): Promise<void> {
        const gltf = await loader.loadModel(url);
        if (!gltf) return;
        const model = gltf.scene;
        if (this.disposed) {
            this.resources.dispose(model);
            return;
        }
        this.prepareMaterials(model);
        try {
            this.animations.initialize(model);
            for (const clip of gltf.animations) this.animations.registerAction(animationName(clip.name), clip);
        } catch (error) {
            this.animations.dispose();
            this.resources.dispose(model);
            throw error;
        }
        model.scale.setScalar(0.01);
        model.position.y = -1;
        this.mesh.remove(this.fallback);
        this.resources.dispose(this.fallback);
        this.mesh.add(model);
        this.model = model;
        this.setAppearance(this.appearance);
        this.setAnimation(this.animation, this.speed);
    }

    public setAppearance(appearance: Readonly<Appearance>): void {
        this.appearance = { ...appearance };
        const color = this.outfitColors.get(appearance.outfit) ?? 0x55ffc1;
        for (const [id, mesh] of this.characters) {
            mesh.visible = appearance.character === id && (id !== 'runner' || this.model === null);
            this.tintMaterials(mesh.material, color);
        }
        if (this.model) this.model.visible = appearance.character === 'runner';
        this.model?.traverse(child => {
            if (!('isMesh' in child) || !child.isMesh) return;
            const mesh = child as THREE.Mesh;
            this.tintMaterials(mesh.material, color);
        });
    }

    private tintMaterials(value: THREE.Material | THREE.Material[], color: number): void {
        for (const material of Array.isArray(value) ? value : [value]) {
            if ('color' in material) {
                const tint = material.color as THREE.Color;
                if (tint?.isColor) tint.setHex(color);
            }
        }
    }

    private prepareMaterials(model: THREE.Object3D): void {
        const meshes: THREE.Mesh[] = [];
        const converted = new Map<THREE.Material, THREE.NodeMaterial>();
        try {
            model.traverse(child => {
                if (!('isMesh' in child) || !child.isMesh) return;
                const mesh = child as THREE.Mesh;
                meshes.push(mesh);
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                for (const material of materials) {
                    if (!converted.has(material)) converted.set(material, MaterialFactory.convert(material));
                }
            });
        } catch (error) {
            for (const [original, replacement] of converted) {
                if (original !== replacement) replacement.dispose();
            }
            this.resources.dispose(model);
            throw error;
        }
        for (const mesh of meshes) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.material = Array.isArray(mesh.material)
                ? mesh.material.map(material => converted.get(material)!)
                : converted.get(mesh.material)!;
        }
        for (const [original, replacement] of converted) {
            // Converted materials retain textures; only release the replaced material itself.
            if (original !== replacement) original.dispose();
        }
    }

    public setPose(pose: Readonly<PlayerPose>): void {
        this.mesh.position.set(pose.x, pose.y, pose.z);
        this.mesh.scale.set(1, pose.scaleY, 1);
        this.mesh.rotation.set(pose.tiltX, 0, 0);
    }

    public setAnimation(animation: PlayerAnimation, speed: number): void {
        this.animation = animation;
        this.speed = speed;
        this.animations.fadeToAction(animation, 0.2);
        if (animation === 'Run') this.animations.setTimeScale('Run', Math.max(1, speed / 30));
    }

    public update(delta: number): void {
        this.animations.update(delta);
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.animations.dispose();
        this.resources.dispose(this.mesh);
        this.mesh.removeFromParent();
    }
}
