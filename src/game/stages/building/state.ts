import { createCorridor, type Corridor, type Furniture } from './data';

// Everything the building changes during an attempt. Lives in state.building.
export type BuildingState = {
    furniture: Furniture[];   // the chair convoy
    corridor: Corridor;       // meeting room, typing bubbles, chatter, lift
};

export function createBuildingState(checkpoint: number, appearanceSeed: number): BuildingState {
    return { furniture: [], corridor: createCorridor(checkpoint, appearanceSeed) };
}
