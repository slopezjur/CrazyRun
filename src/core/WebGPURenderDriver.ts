import type * as THREE from 'three/webgpu';
import type { IRenderDriver } from './Engine';

export class WebGPURenderDriver implements IRenderDriver {
    private readonly events = new AbortController();
    private initialization: Promise<void> | undefined;
    private initialized = false;
    private disposed = false;

    constructor(
        private readonly renderer: THREE.WebGPURenderer,
        private readonly scene: THREE.Scene,
        private readonly camera: THREE.PerspectiveCamera,
        private readonly viewport: Window
    ) {
        this.resize();
        viewport.addEventListener('resize', this.resize, { signal: this.events.signal });
    }

    private readonly resize = (): void => {
        const width = Math.max(1, this.viewport.innerWidth);
        const height = Math.max(1, this.viewport.innerHeight);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(this.viewport.devicePixelRatio);
    };

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
        this.events.abort();
        if (this.initialized) {
            this.renderer.dispose();
        } else if (this.initialization) {
            // Three.js r167 requires initialization before its renderer can be disposed.
            void this.initialization.then(() => this.renderer.dispose(), () => {});
        }
    }
}
