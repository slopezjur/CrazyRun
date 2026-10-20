import type * as THREE from 'three/webgpu';

export interface IResizeObservation {
    observe(element: Element): void;
    disconnect(): void;
}
export type ResizeObservationFactory = (resize: () => void) => IResizeObservation | undefined;

function browserResizeObservation(resize: () => void): IResizeObservation | undefined {
    return typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
}

/** Binds browser layout changes to the rendering surface; owns no GPU lifecycle. */
export class ViewportBinding {
    private readonly events = new AbortController();
    private readonly observation: IResizeObservation | undefined;
    private width = 0;
    private height = 0;
    private pixelRatio = 0;

    constructor(
        private readonly renderer: Pick<THREE.WebGPURenderer, 'setSize' | 'setPixelRatio'>,
        private readonly camera: Pick<THREE.PerspectiveCamera, 'aspect' | 'updateProjectionMatrix'>,
        private readonly viewport: Window,
        private readonly container?: HTMLElement,
        observe: ResizeObservationFactory = browserResizeObservation
    ) {
        this.resize();
        viewport.addEventListener('resize', this.resize, { signal: this.events.signal });
        if (container) {
            this.observation = observe(this.resize);
            this.observation?.observe(container);
        }
    }

    private readonly resize = (): void => {
        if (this.events.signal.aborted) return;
        const width = Math.max(1, this.container?.clientWidth ?? this.viewport.innerWidth);
        const height = Math.max(1, this.container?.clientHeight ?? this.viewport.innerHeight);
        const pixelRatio = this.viewport.devicePixelRatio;
        if (width === this.width && height === this.height && pixelRatio === this.pixelRatio) return;
        const ratioChanged = pixelRatio !== this.pixelRatio;
        this.width = width;
        this.height = height;
        this.pixelRatio = pixelRatio;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        if (ratioChanged) this.renderer.setPixelRatio(pixelRatio);
        this.renderer.setSize(width, height, false);
    };

    public dispose(): void {
        if (this.events.signal.aborted) return;
        this.events.abort();
        this.observation?.disconnect();
    }
}
