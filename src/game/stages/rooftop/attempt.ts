import type { Attempt } from '../../state';
import { STAGE_THREE } from './data';

const SHAFT_FLAG = STAGE_THREE.checkpoints.findIndex(mark => mark.x === 1310);

export function prepareRooftopAttempt(attempt: Attempt, checkpoint: number) {
    attempt.extinguisher.owned = checkpoint > 0;
    if (checkpoint === 0) attempt.rooftop.entrance = { kind: 'opening', age: 0 };
    if (checkpoint >= SHAFT_FLAG) attempt.rooftop.duct = { kind: 'done', shots: 1, rest: 0 };
}
