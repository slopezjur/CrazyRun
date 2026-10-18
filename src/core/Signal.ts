export type Unsubscribe = () => void;

export class Signal<T> {
    private readonly listeners = new Set<(value: T) => void>();

    public subscribe(listener: (value: T) => void): Unsubscribe {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    public emit(value: T): void {
        for (const listener of this.listeners) listener(value);
    }

    public clear(): void {
        this.listeners.clear();
    }
}
