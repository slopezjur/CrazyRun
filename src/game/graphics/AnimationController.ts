import * as THREE from 'three/webgpu';

export class AnimationController {
    private mixer?: THREE.AnimationMixer;
    private actions: Map<string, THREE.AnimationAction> = new Map();
    private activeAction?: THREE.AnimationAction;

    public initialize(mesh: THREE.Object3D): void {
        this.mixer = new THREE.AnimationMixer(mesh);
    }

    public registerAction(name: string, clip: THREE.AnimationClip): void {
        if (!this.mixer) return;
        const action = this.mixer.clipAction(clip);
        this.actions.set(name, action);
    }

    public getAction(name: string): THREE.AnimationAction | undefined {
        return this.actions.get(name);
    }

    public fadeToAction(name: string, duration: number): void {
        if (!this.mixer) return;
        
        const newAction = this.actions.get(name);
        if (!newAction || newAction === this.activeAction) return;

        newAction.reset();
        newAction.setEffectiveTimeScale(1);
        newAction.setEffectiveWeight(1);
        
        if (this.activeAction) {
            newAction.crossFadeFrom(this.activeAction, duration, true);
        }
        
        newAction.play();
        this.activeAction = newAction;
    }

    public update(deltaTime: number): void {
        this.mixer?.update(deltaTime);
    }
}
