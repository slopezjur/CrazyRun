import type { ISoundPlayer } from '../game/AudioManager';
import type { RunEvent } from '../game/RunSession';

interface FeedbackRule { readonly sound?: string; readonly pitch?: number; readonly shake?: number; }
export type FeedbackRules = Readonly<Partial<Record<RunEvent['type'], FeedbackRule>>>;
export const FEEDBACK_RULES: FeedbackRules = {
    warning: { sound: 'warning' }, combo: { sound: 'reward', pitch: 1.25 },
    shieldSaved: { sound: 'reward', shake: 0.5 }, smash: { shake: 0.5 },
    chain: { sound: 'reward' }, nearMiss: { sound: 'reward' }, crazy: { sound: 'reward' },
    milestone: { sound: 'reward' }, biome: { sound: 'reward' }, spectacle: { sound: 'reward' },
    powerUp: { sound: 'reward' }
};

export class RunFeedback {
    constructor(
        private readonly effects: { event(event: RunEvent, motion: number): void },
        private readonly motion: () => number,
        private readonly audio: ISoundPlayer,
        private readonly camera: { triggerShake(intensity: number): void },
        private readonly rules: FeedbackRules = FEEDBACK_RULES
    ) {}

    public readonly handle = (event: RunEvent): void => {
        this.effects.event(event, this.motion());
        const rule = this.rules[event.type];
        if (rule?.sound) this.audio.play(rule.sound, rule.pitch ?? 1);
        if (rule?.shake !== undefined) this.camera.triggerShake(rule.shake);
    };
}
