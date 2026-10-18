export interface IRenderDriver {
    initialize(): Promise<void>;
    setAnimationLoop(callback: ((time: number) => void) | null): Promise<void>;
    render(): void;
    dispose(): void;
}

export interface IFrameObserver {
    begin(): void;
    end(): void;
}

export class Engine {
    private previousTime: number | undefined;
    private disposed = false;
    private started = false;

    constructor(
        private readonly renderer: IRenderDriver,
        private readonly update: (delta: number) => void,
        private readonly observer?: IFrameObserver
    ) {}

    public async start(): Promise<void> {
        if (this.disposed || this.started) return;
        this.started = true;
        await this.renderer.initialize();
        if (!this.disposed) await this.renderer.setAnimationLoop(this.frame);
    }

    private readonly frame = (time: number): void => {
        if (this.disposed) return;
        this.observer?.begin();
        try {
            const delta = this.previousTime === undefined ? 0 : (time - this.previousTime) / 1000;
            this.previousTime = time;
            this.update(delta);
            this.renderer.render();
        } finally {
            this.observer?.end();
        }
    };

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.renderer.dispose();
    }
}
