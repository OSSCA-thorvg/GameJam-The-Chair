import type { Attempt } from '../../state';
import { STAGE_FIVE } from './data';

export function prepareOrbitAttempt(attempt: Attempt, checkpoint: number) {
    attempt.extinguisher.owned = true;
    attempt.extinguisher.burst = .24;
    if (checkpoint > STAGE_FIVE.restarts.length) {
        Object.assign(attempt.orbit, { phase: 'parked', z: STAGE_FIVE.checkpoint.z, speed: 0, rings: 2 });
    } else if (checkpoint > 0) {
        Object.assign(attempt.orbit, { phase: 'door', z: STAGE_FIVE.restarts[checkpoint - 1], speed: STAGE_FIVE.cruise });
    }
}
