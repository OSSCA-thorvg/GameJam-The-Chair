import { startMark } from '../types';
import { STAGE_FOUR } from './data';

import type { StageDefinition } from '../types';

export const sky: StageDefinition = {
    id: 4,
    name: 'cloud-stage-four',
    length: STAGE_FOUR.length,
    goal: STAGE_FOUR.goal,
    terrain: [],
    checkpoints: STAGE_FOUR.checkpoints.map(startMark),
    checkpointRule: 'pass',
    people: [],
    practicePile: false,
    alwaysUpright: true,
    newSkylineEachAttempt: false,
    finishAtGoal: false,
};

export const skyConfig = { stageFour: STAGE_FOUR };
