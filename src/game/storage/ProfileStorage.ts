import type { IKeyValueStorage, IValueStorage } from '../../core/StorageService';
import { boundedCount, emptyProfile, PROGRESSION_RULES, type ProfileData, type ProgressionRules } from '../ProgressionRules';

const KEY = 'crazyrun_profile_v1';
function object(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown> : {};
}

export class ProfileStorage implements IValueStorage<ProfileData> {
    constructor(
        private readonly storage: IKeyValueStorage,
        private readonly reducedMotion = false,
        private readonly rules: ProgressionRules = PROGRESSION_RULES
    ) {}

    public load(): ProfileData {
        const profile = emptyProfile(this.rules, this.reducedMotion);
        let raw: Record<string, unknown>;
        try { raw = object(JSON.parse(this.storage.getItem(KEY) ?? 'null')); }
        catch { return profile; }
        if (raw.version !== 1) return profile;
        profile.wallet = boundedCount(raw.wallet);
        const appearance = object(raw.appearance);
        for (const item of this.rules.cosmetics) {
            if (Array.isArray(raw.owned) && raw.owned.includes(item.id) && !profile.owned.includes(item.id)) {
                profile.owned.push(item.id);
            }
            if (appearance[item.slot] === item.id && profile.owned.includes(item.id)) profile.appearance[item.slot] = item.id;
        }
        const progress = object(raw.progress);
        for (const mission of this.rules.missions) {
            profile.progress[mission.id] = Math.min(mission.goal, boundedCount(progress[mission.id]));
            if (profile.progress[mission.id] === mission.goal) profile.completed.push(mission.id);
        }
        if (typeof raw.motion === 'number' && Number.isFinite(raw.motion)) profile.motion = Math.max(0, Math.min(1, raw.motion));
        if (typeof raw.ghost === 'boolean') profile.ghost = raw.ghost;
        for (const [key, value] of Object.entries(object(raw.bests)).slice(-32)) {
            if (/^v\d+:(daily|free):[\w:.-]{1,100}$/.test(key)) profile.bests[key] = boundedCount(value);
        }
        return profile;
    }

    public save(profile: ProfileData): void {
        this.storage.setItem(KEY, JSON.stringify(profile));
    }
}
