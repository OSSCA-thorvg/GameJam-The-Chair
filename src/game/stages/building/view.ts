import { clonePlain } from '../../data';

import type { BuildingState } from './state';

type BuildingSource = Pick<BuildingState, 'furniture' | 'corridor'>;
export type BuildingSnapshot = BuildingSource & { canEnterMeeting: boolean };

export function createBuildingSnapshot(
    building: Readonly<BuildingSource>,
    canEnterMeeting: boolean,
): BuildingSnapshot {
    return {
        furniture: clonePlain(building.furniture),
        corridor: clonePlain(building.corridor),
        canEnterMeeting,
    };
}
