import * as THREE from 'three/webgpu';

export class AnimationController {
    private mixer?: THREE.AnimationMixer;
    private readonly actions = new Map<string, THREE.AnimationAction>();
    private activeAction?: THREE.AnimationAction;
    private root?: THREE.Object3D;

    public initialize(mesh: THREE.Object3D): void {
        this.dispose();
        this.root = mesh;
        this.mixer = new THREE.AnimationMixer(mesh);
    }

    public registerAction(name: string, clip: THREE.AnimationClip): void {
        if (this.mixer) this.actions.set(name, this.mixer.clipAction(clip));
    }

    public setTimeScale(name: string, speed: number): void {
        this.actions.get(name)?.setEffectiveTimeScale(speed);
    }

    public fadeToAction(name: string, duration: number): void {
        const action = this.actions.get(name);
        if (!action || action === this.activeAction) return;
        action.reset();
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(1);
        if (this.activeAction) action.crossFadeFrom(this.activeAction, duration, true);
        action.play();
        this.activeAction = action;
    }

    public update(delta: number): void {
        this.mixer?.update(delta);
    }

    public dispose(): void {
        this.mixer?.stopAllAction();
        if (this.root) this.mixer?.uncacheRoot(this.root);
        this.actions.clear();
        this.mixer = undefined;
        this.root = undefined;
        this.activeAction = undefined;
    }
}
