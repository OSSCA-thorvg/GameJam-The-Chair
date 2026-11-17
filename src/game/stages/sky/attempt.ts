import type { Attempt } from '../../state';

export function prepareSkyAttempt(attempt: Attempt, checkpoint: number): void {
    attempt.extinguisher.owned = true;
    attempt.extinguisher.burst = 0.24;
    if (checkpoint > 0) {
        attempt.sky.phase = 'course';
        attempt.sky.lift = 1;
    }
}
