import { Signal, type Unsubscribe } from '../core/Signal';

export interface ITrackChunk {
    readonly length: number;
    readonly zPosition: number;
    setZPosition(z: number): void;
    shiftZ(amount: number): void;
}

export interface IChunkManager {
    onChunkRecycled(listener: (z: number) => void): Unsubscribe;
    forEachPosition(visitor: (z: number, index: number) => void): void;
    updatePooling(referenceZ: number): void;
    scroll(amount: number): void;
    reset(): void;
}

export class ChunkManager implements IChunkManager {
    private readonly chunks: ITrackChunk[];
    private readonly recycled = new Signal<number>();

    constructor(chunks: readonly ITrackChunk[]) {
        if (chunks.length === 0 || chunks.some(chunk => !Number.isFinite(chunk.length)
            || chunk.length <= 0 || chunk.length !== chunks[0].length)) {
            throw new Error('Track chunks must have the same positive, finite length.');
        }
        this.chunks = [...chunks];
        this.reset();
    }

    public onChunkRecycled(listener: (z: number) => void): Unsubscribe {
        return this.recycled.subscribe(listener);
    }

    public forEachPosition(visitor: (z: number, index: number) => void): void {
        for (let i = 0; i < this.chunks.length; i++) visitor(this.chunks[i].zPosition, i);
    }

    public updatePooling(referenceZ: number): void {
        while (this.chunks[0].zPosition > referenceZ + this.chunks[0].length) {
            const oldest = this.chunks.shift()!;
            const furthest = this.chunks[this.chunks.length - 1];
            const nextZ = furthest ? furthest.zPosition - oldest.length : oldest.zPosition - oldest.length;
            oldest.setZPosition(nextZ);
            this.chunks.push(oldest);
            this.recycled.emit(nextZ);
        }
    }

    public scroll(amount: number): void {
        for (const chunk of this.chunks) chunk.shiftZ(amount);
    }

    public reset(): void {
        for (let i = 0; i < this.chunks.length; i++) {
            this.chunks[i].setZPosition(-i * this.chunks[i].length);
        }
    }

    public dispose(): void {
        this.recycled.clear();
    }
}
