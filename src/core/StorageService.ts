export interface IKeyValueStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

export interface IValueStorage<T> {
    load(): T;
    save(value: T): void;
}

export class BrowserStorage implements IKeyValueStorage {
    private readonly fallback = new Map<string, string>();

    constructor(private readonly getStorage: () => IKeyValueStorage) {}

    public getItem(key: string): string | null {
        if (this.fallback.has(key)) return this.fallback.get(key)!;
        try {
            return this.getStorage().getItem(key);
        } catch {
            return null;
        }
    }

    public setItem(key: string, value: string): void {
        this.fallback.set(key, value);
        try {
            this.getStorage().setItem(key, value);
        } catch {
            // Keep settings available for the session when browser storage is blocked.
        }
    }
}

export class StoredValue<T> implements IValueStorage<T> {
    constructor(
        private readonly storage: IKeyValueStorage,
        private readonly key: string,
        private readonly decode: (value: string | null) => T,
        private readonly encode: (value: T) => string
    ) {}

    public load(): T {
        return this.decode(this.storage.getItem(this.key));
    }

    public save(value: T): void {
        this.storage.setItem(this.key, this.encode(value));
    }
}

export function parseHighScore(value: string | null): number {
    const score = value === null ? 0 : Number(value);
    return Number.isSafeInteger(score) && score >= 0 ? score : 0;
}
