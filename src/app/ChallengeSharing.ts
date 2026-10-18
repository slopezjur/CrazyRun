import { challengeUrl, type Challenge } from '../game/Challenge';

export class ChallengeSharing {
    constructor(private readonly baseUrl: () => string, private readonly copy: (text: string) => Promise<void>) {}

    public async share(challenge: Challenge): Promise<string> {
        const link = challengeUrl(this.baseUrl(), challenge);
        if (!link) return '';
        try { await this.copy(link); } catch { /* The selectable link remains available. */ }
        return link;
    }
}
