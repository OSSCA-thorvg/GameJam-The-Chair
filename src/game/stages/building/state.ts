import { createCorridor } from './data';

import type { Corridor, Furniture } from './data';

export type BuildingState = {
    furniture: Furniture[];
    corridor: Corridor;
};

export function createBuildingState(
    checkpoint: number,
    appearanceSeed: number,
): BuildingState {
    return {
        furniture: [],
        corridor: createCorridor(checkpoint, appearanceSeed),
    };
}
