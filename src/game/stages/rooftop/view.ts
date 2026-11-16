import { clonePlain } from '../../data';
import type { RooftopState } from './state';

type RooftopSource = Pick<
    RooftopState,
    'flight' | 'entrance' | 'duct' | 'airSprays'
>;

export type RooftopSnapshot = Pick<RooftopState, 'airSprays'> & {
    firstFlight: RooftopState['flight'];
    rooftopEntrance: RooftopState['entrance'];
    ductReaction: RooftopState['duct'];
};

export function createRooftopSnapshot(
    rooftop: Readonly<RooftopSource>,
): RooftopSnapshot {
    return {
        firstFlight: clonePlain(rooftop.flight),
        rooftopEntrance: clonePlain(rooftop.entrance),
        ductReaction: clonePlain(rooftop.duct),
        airSprays: rooftop.airSprays,
    };
}
