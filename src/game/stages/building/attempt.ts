import type { Attempt } from '../../state';
import { createFurniture } from './data';

// Past the first flag the chair convoy has already left the meeting room.
export function prepareBuildingAttempt(attempt: Attempt, checkpoint: number) {
    attempt.building.furniture = createFurniture(checkpoint);
}
