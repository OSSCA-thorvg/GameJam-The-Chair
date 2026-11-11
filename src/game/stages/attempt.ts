// Stage-specific parts of a fresh attempt. One case per stage; each stage keeps its rules in its own folder.
import type { Attempt } from '../state';
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
    }
}
