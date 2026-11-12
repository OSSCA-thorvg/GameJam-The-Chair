import type { Attempt } from '../../state';
import { STAGE_FIVE } from './data';

export function prepareOrbitAttempt(attempt: Attempt, checkpoint: number) {
    attempt.hasExtinguisher = true;
    attempt.sprayBurst = .24;
    if (checkpoint > 0) {
        Object.assign(attempt.orbit, { phase: 'parked', z: STAGE_FIVE.checkpoint.z, speed: 0, rings: 2 });
    }
}
