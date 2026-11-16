import { createCorridor, type Corridor, type Furniture } from './data';

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
