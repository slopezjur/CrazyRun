import type { IRunState, RunEvent } from '../game/RunSession';

export interface RunNoticeView {
    readonly event: RunEvent;
    readonly key: string;
    readonly warning: boolean;
}
export interface IRunNotices {
    readonly current: RunNoticeView | null;
    accept(event: RunEvent): boolean;
    reset(): void;
}
interface NoticeRule {
    readonly duration: number;
    readonly key: string | ((run: Pick<IRunState, 'biome'>, event: RunEvent) => string);
    readonly warning?: boolean;
    readonly allowDuringWarning?: boolean;
    readonly interruptions?: readonly RunEvent['type'][];
}
export type NoticeRules = Readonly<Partial<Record<RunEvent['type'], NoticeRule>>>;
const notice = (key: string): NoticeRule => ({ key, duration: 2.5 });
export const NOTICE_RULES: NoticeRules = {
    chain: notice('chain'), nearMiss: notice('nearMiss'), shieldSaved: notice('shieldSaved'),
    milestone: notice('milestone'), combo: notice('combo'),
    powerUp: { key: (_run, event) => event.type === 'powerUp' ? event.powerUp : 'powerUp', duration: 2.5 },
    crazy: { ...notice('crazy'), interruptions: ['warning', 'shieldSaved'] },
    biome: { key: run => run.biome, duration: 2.5 },
    warning: { key: run => 'warning_' + run.biome, duration: 4, warning: true, allowDuringWarning: true },
    spectacle: { key: run => 'spectacle_' + run.biome, duration: 2.5, warning: true }
};

export class RunNotices implements IRunNotices {
    private event: RunEvent | null = null;
    private until = 0;

    constructor(
        private readonly run: Pick<IRunState, 'elapsed' | 'biome' | 'spectacle'>,
        private readonly rules: NoticeRules = NOTICE_RULES
    ) {}

    public accept(event: RunEvent): boolean {
        const rule = this.rules[event.type];
        if (!rule || (this.run.spectacle === 'warning' && !rule.allowDuringWarning)) return false;
        const currentRule = this.event && this.rules[this.event.type];
        if (currentRule?.interruptions && this.run.elapsed < this.until
            && !currentRule.interruptions.includes(event.type)) return false;
        this.event = event;
        this.until = this.run.elapsed + rule.duration;
        return true;
    }

    public get current(): RunNoticeView | null {
        if (!this.event || this.run.elapsed > this.until) return null;
        const rule = this.rules[this.event.type];
        if (!rule) return null;
        return {
            event: this.event,
            key: typeof rule.key === 'string' ? rule.key : rule.key(this.run, this.event),
            warning: rule.warning === true
        };
    }

    public reset(): void { this.event = null; this.until = 0; }
}
