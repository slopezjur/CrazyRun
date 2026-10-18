import type { IKeyValueStorage, IValueStorage } from '../../core/StorageService';
import { MAX_GHOST_FRAMES, type GhostRecord } from '../GhostData';

const KEY = 'crazyrun_ghosts_v1';

function validRecord(value: unknown): value is GhostRecord {
    if (!value || typeof value !== 'object') return false;
    const record = value as GhostRecord;
    if (typeof record.key !== 'string' || record.key.length > 140
        || !Number.isSafeInteger(record.score) || record.score < 0
        || !Array.isArray(record.frames) || record.frames.length < 2 || record.frames.length > MAX_GHOST_FRAMES) return false;
    let time = -1;
    let distance = -1;
    for (const frame of record.frames) {
        if (!Array.isArray(frame) || frame.length !== 6 || !frame.every(Number.isFinite)
            || frame[0] <= time || frame[1] < distance || frame[0] < 0 || frame[1] < 0
            || Math.abs(frame[2]) > 2 || frame[3] < 0 || frame[3] > 6
            || frame[4] < 0.4 || frame[4] > 1.1 || Math.abs(frame[5]) > 1) return false;
        time = frame[0];
        distance = frame[1];
    }
    return true;
}

export class GhostStorage implements IValueStorage<readonly GhostRecord[]> {
    constructor(private readonly storage: IKeyValueStorage) {}

    public load(): readonly GhostRecord[] {
        try {
            const raw = this.storage.getItem(KEY);
            const records: unknown = raw && raw.length < 3_000_000 ? JSON.parse(raw) : [];
            return Array.isArray(records) ? records.filter(validRecord).slice(-3) : [];
        } catch { return []; }
    }

    public save(records: readonly GhostRecord[]): void {
        this.storage.setItem(KEY, JSON.stringify(records.slice(-3)));
    }
}
