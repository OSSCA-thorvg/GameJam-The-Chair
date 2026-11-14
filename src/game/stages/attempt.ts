import type { Attempt } from '../state';
import { createOfficeState } from './office/state';
import { createBuildingState } from './building/state';
import { createRooftopState } from './rooftop/state';
import { createOrbitState } from './orbit/state';
import { prepareOrbitAttempt } from './orbit/attempt';
import { createSky } from './sky/data';
import type { StageId } from '../types';
import { prepareOfficeAttempt } from './office/attempt';
import { prepareBuildingAttempt } from './building/attempt';
import { prepareRooftopAttempt } from './rooftop/attempt';
import { prepareSkyAttempt } from './sky/attempt';

export function prepareStageAttempt(stage: StageId, attempt: Attempt, checkpoint: number) {
    switch (stage) {
        case 1: return prepareOfficeAttempt(attempt);
        case 2: return prepareBuildingAttempt(attempt, checkpoint);
        case 3: return prepareRooftopAttempt(attempt, checkpoint);
        case 4: return prepareSkyAttempt(attempt, checkpoint);
        case 5: return prepareOrbitAttempt(attempt, checkpoint);
    }
}

// Every stage's own state for a fresh attempt (all four exist; only the current stage changes its own).
export function createStageStates(checkpoint: number, appearanceSeed: number) {
    return {
        office: createOfficeState(),
        building: createBuildingState(checkpoint, appearanceSeed),
        rooftop: createRooftopState(),
        sky: createSky(),
        orbit: createOrbitState(),
    };
}
