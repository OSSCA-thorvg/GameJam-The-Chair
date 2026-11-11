import type { Attempt } from '../../state';

// The door scene plays only from the stage start; later flags already have the extinguisher.
export function prepareRooftopAttempt(attempt: Attempt, checkpoint: number) {
    attempt.hasExtinguisher = checkpoint > 0;
    if (checkpoint === 0) attempt.rooftop.entrance = { kind: 'opening', age: 0 };
}
