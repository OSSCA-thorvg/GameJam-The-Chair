import type { Attempt } from '../../state';
import { STAGE_FIVE } from './data';

export function prepareOrbitAttempt(attempt: Attempt, checkpoint: number) {
    attempt.hasExtinguisher = true;
    attempt.sprayBurst = .24;
    // The last flag is the Earth's shadow; the ones before it restart the flight at cruise speed.
    if (checkpoint > STAGE_FIVE.restarts.length) {
        Object.assign(attempt.orbit, { phase: 'parked', z: STAGE_FIVE.checkpoint.z, speed: 0, rings: 2 });
    } else if (checkpoint > 0) {
        Object.assign(attempt.orbit, { phase: 'door', z: STAGE_FIVE.restarts[checkpoint - 1], speed: STAGE_FIVE.cruise });
    }
}
