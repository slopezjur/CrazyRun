import { RunSession } from '../../src/game/RunSession.ts';
import { PowerUpEffects, POWER_UP_DEFINITIONS } from '../../src/game/PowerUps.ts';

export function createRunSession(challenge) {
    return new RunSession(challenge, new PowerUpEffects(POWER_UP_DEFINITIONS));
}
