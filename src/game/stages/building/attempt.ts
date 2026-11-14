import type { Attempt } from '../../state';
import { createFurniture } from './data';

// The first flag is before dispatch; later flags resume with the convoy already rolling.
export function prepareBuildingAttempt(attempt: Attempt, checkpoint: number) {
    attempt.building.furniture = createFurniture(checkpoint);
}
