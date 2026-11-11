import type { Attempt } from '../../state';

// The chair arrives spraying; a retry after the first flag resumes with the building already grown.
export function prepareSkyAttempt(attempt: Attempt, checkpoint: number) {
    attempt.hasExtinguisher = true;
    attempt.sprayBurst = .24;
    if (checkpoint > 0) {
        attempt.sky.phase = 'course';
        attempt.sky.lift = 1;
    }
}
