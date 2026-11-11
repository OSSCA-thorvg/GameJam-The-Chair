import type { DuctReaction, FirstFlight, RooftopEntrance } from './course/decide';

// Everything the rooftop changes during an attempt. Lives in state.rooftop.
export type RooftopState = {
    entrance: RooftopEntrance;
    duct: DuctReaction;
    flight: FirstFlight;
};

export function createRooftopState(): RooftopState {
    return { entrance: { kind: 'ready' }, duct: { kind: 'idle' }, flight: { kind: 'course', verticalShots: 0, lastShotAt: -1 } };
}
