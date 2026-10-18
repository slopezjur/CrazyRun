import { Signal, type Unsubscribe } from './Signal';

export class SimulationLoop {
    private readonly fixedUpdates = new Set<(delta: number) => void>();
    private readonly frameUpdates = new Set<(delta: number) => void>();
    private readonly rates = new Signal<number>();
    private accumulator = 0;
    private updates = 0;
    private rateTimer = 0;

    constructor(
        private readonly isPaused: () => boolean,
        private readonly fixedStep = 1 / 60
    ) {
        if (!Number.isFinite(fixedStep) || fixedStep <= 0) {
            throw new RangeError('The fixed timestep must be positive and finite.');
        }
    }

    public onFixedUpdate(update: (delta: number) => void): Unsubscribe {
        this.fixedUpdates.add(update);
        return () => { this.fixedUpdates.delete(update); };
    }

    public onFrameUpdate(update: (delta: number) => void): Unsubscribe {
        this.frameUpdates.add(update);
        return () => { this.frameUpdates.delete(update); };
    }

    public onUpdateRate(listener: (updates: number) => void): Unsubscribe {
        return this.rates.subscribe(listener);
    }

    public tick(delta: number): void {
        const elapsed = Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, 0.1));
        if (this.isPaused()) {
            this.accumulator = 0;
        } else {
            this.accumulator += elapsed;
            while (this.accumulator >= this.fixedStep && !this.isPaused()) {
                for (const update of this.fixedUpdates) update(this.fixedStep);
                this.accumulator -= this.fixedStep;
                this.updates++;
            }
            if (!this.isPaused()) {
                for (const update of this.frameUpdates) update(elapsed);
            }
        }

        this.rateTimer += elapsed;
        if (this.rateTimer >= 1) {
            this.rates.emit(this.updates);
            this.updates = 0;
            this.rateTimer -= 1;
        }
    }

    public dispose(): void {
        this.fixedUpdates.clear();
        this.frameUpdates.clear();
        this.rates.clear();
    }
}
