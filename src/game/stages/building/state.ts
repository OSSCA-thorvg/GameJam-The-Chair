import { createCorridor, type Corridor, type Furniture } from './data';

export type BuildingState = {
    furniture: Furniture[];   // the chair convoy
    corridor: Corridor;       // meeting room, typing bubbles, chatter, lift
};

export function createBuildingState(checkpoint: number, appearanceSeed: number): BuildingState {
    return { furniture: [], corridor: createCorridor(checkpoint, appearanceSeed) };
}
