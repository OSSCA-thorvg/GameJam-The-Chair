import { prepareBuildingAttempt } from './building/attempt';
import { createBuildingState } from './building/state';
import { prepareOfficeAttempt } from './office/attempt';
import { createOfficeState } from './office/state';
import { prepareOrbitAttempt } from './orbit/attempt';
import { createOrbitState } from './orbit/state';
import { prepareRooftopAttempt } from './rooftop/attempt';
import { createRooftopState } from './rooftop/state';
import { prepareSkyAttempt } from './sky/attempt';
import { createSky } from './sky/data';

import type { Attempt } from '../state';
import type { StageId } from '../types';
import type { BuildingState } from './building/state';
import type { OfficeState } from './office/state';
import type { OrbitState } from './orbit/data';
import type { RooftopState } from './rooftop/state';
import type { SkyState } from './sky/data';

export function prepareStageAttempt(
    stage: StageId,
    attempt: Attempt,
    checkpoint: number,
): void {
    switch (stage) {
        case 1:
            return prepareOfficeAttempt(attempt);
        case 2:
            return prepareBuildingAttempt(attempt, checkpoint);
        case 3:
            return prepareRooftopAttempt(attempt, checkpoint);
        case 4:
            return prepareSkyAttempt(attempt, checkpoint);
        case 5:
            return prepareOrbitAttempt(attempt, checkpoint);
    }
}

export function createStageStates(
    checkpoint: number,
    appearanceSeed: number,
): {
    office: OfficeState;
    building: BuildingState;
    rooftop: RooftopState;
    sky: SkyState;
    orbit: OrbitState;
} {
    return {
        office: createOfficeState(),
        building: createBuildingState(checkpoint, appearanceSeed),
        rooftop: createRooftopState(),
        sky: createSky(),
        orbit: createOrbitState(),
    };
}
