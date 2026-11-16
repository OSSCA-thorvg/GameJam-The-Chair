import type { Attempt } from '../../state';
import { createFurniture } from './data';

export function prepareBuildingAttempt(attempt: Attempt, checkpoint: number) {
    attempt.building.furniture = createFurniture(checkpoint);
}
