import type { Attempt } from '../../state';
import { STAGE_THREE } from './data';

// The flag halfway up the duct shaft.
const SHAFT_FLAG = STAGE_THREE.checkpoints.findIndex(mark => mark.x === 1310);

// The door scene plays only from the stage start; later flags already have the extinguisher.
// From the shaft flag on, the duct is already awake: its junk lies on the ledges and it keeps gusting.
export function prepareRooftopAttempt(attempt: Attempt, checkpoint: number) {
    attempt.hasExtinguisher = checkpoint > 0;
    if (checkpoint === 0) attempt.rooftop.entrance = { kind: 'opening', age: 0 };
    if (checkpoint >= SHAFT_FLAG) attempt.rooftop.duct = { kind: 'done', shots: 1, rest: 0 };
}
