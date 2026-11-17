import { createFurniture } from './data';

import type { Attempt } from '../../state';

export function prepareBuildingAttempt(
    attempt: Attempt,
    checkpoint: number,
): void {
    attempt.building.furniture = createFurniture(checkpoint);
}
