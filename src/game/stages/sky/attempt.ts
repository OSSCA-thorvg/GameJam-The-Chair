import type { Attempt } from '../../state';

export function prepareSkyAttempt(attempt: Attempt, checkpoint: number) {
    attempt.extinguisher.owned = true;
    attempt.extinguisher.burst = .24;
    if (checkpoint > 0) {
        attempt.sky.phase = 'course';
        attempt.sky.lift = 1;
    }
}
