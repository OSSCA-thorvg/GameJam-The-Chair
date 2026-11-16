import type { DuctReaction, FirstFlight, RooftopEntrance } from './course/decide';

export type RooftopState = {
    entrance: RooftopEntrance;
    duct: DuctReaction;
    flight: FirstFlight;
    airSprays: number;
};

export function createRooftopState(): RooftopState {
    return { entrance: { kind: 'ready' }, duct: { kind: 'idle', rest: 0 }, flight: { kind: 'course' }, airSprays: 0 };
}
