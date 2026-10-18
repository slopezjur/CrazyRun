export class Lifetime {
    private readonly cleanups: (() => void)[] = [];
    private disposed = false;

    public get isDisposed(): boolean {
        return this.disposed;
    }

    public use<T extends { dispose(): void }>(resource: T): T {
        this.defer(() => resource.dispose());
        return resource;
    }

    public defer(cleanup: () => void): void {
        if (this.disposed) cleanup();
        else this.cleanups.push(cleanup);
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        const errors: unknown[] = [];
        for (let i = this.cleanups.length - 1; i >= 0; i--) {
            try {
                this.cleanups[i]();
            } catch (error) {
                errors.push(error);
            }
        }
        this.cleanups.length = 0;
        if (errors.length) throw new AggregateError(errors, 'Application cleanup failed.');
    }
}
