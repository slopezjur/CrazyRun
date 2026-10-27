import type * as THREE from 'three/webgpu';
import type { IRenderDriver } from './Engine';

export class WebGPURenderDriver implements IRenderDriver {
    private initialization: Promise<unknown> | undefined;
    private initialized = false;
    private disposed = false;

    constructor(
        private readonly renderer: Pick<THREE.WebGPURenderer, 'init' | 'setAnimationLoop' | 'render' | 'dispose'>,
        private readonly scene: THREE.Scene,
        private readonly camera: THREE.PerspectiveCamera
    ) {}

    public async initialize(): Promise<void> {
        this.initialization ??= this.renderer.init();
        await this.initialization;
        this.initialized = true;
    }

    public async setAnimationLoop(callback: ((time: number) => void) | null): Promise<void> {
        if (!this.disposed) await this.renderer.setAnimationLoop(callback);
    }

    public render(): void {
        if (!this.disposed) this.renderer.render(this.scene, this.camera);
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        if (this.initialized) {
            void this.renderer.dispose();
        } else if (this.initialization) {
            // The renderer only releases its backend once initialized, so dispose after initialization settles.
            void this.initialization.then(() => this.renderer.dispose(), () => {});
        }
    }
}
