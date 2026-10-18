export interface IEntityPool<T> {
    getInactive(): T | null;
    getAll(): readonly T[];
}

export class EntityPool<T extends { readonly isActive: boolean }> implements IEntityPool<T> {
    private readonly entities: T[] = [];

    constructor(size: number, factory: () => T) {
        if (!Number.isSafeInteger(size) || size < 0) {
            throw new RangeError('Pool size must be a non-negative integer.');
        }
        for (let i = 0; i < size; i++) this.entities.push(factory());
    }

    public getInactive(): T | null {
        for (const entity of this.entities) {
            if (!entity.isActive) return entity;
        }
        return null;
    }

    public getAll(): readonly T[] {
        return this.entities;
    }
}
