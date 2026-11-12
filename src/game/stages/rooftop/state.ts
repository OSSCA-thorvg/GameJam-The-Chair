import type { DuctReaction, FirstFlight, RooftopEntrance } from './course/decide';

// Everything the rooftop changes during an attempt. Lives in state.rooftop.
export type RooftopState = {
    entrance: RooftopEntrance;
    duct: DuctReaction;
    flight: FirstFlight;
    // Extinguisher bursts fired since the wheels last touched the ground.
    airSprays: number;
};

export function createRooftopState(): RooftopState {
    return { entrance: { kind: 'ready' }, duct: { kind: 'idle', rest: 0 }, flight: { kind: 'course' }, airSprays: 0 };
}
