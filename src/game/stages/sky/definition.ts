import { startMark, type StageDefinition } from '../types';
import { STAGE_FOUR } from './data';

// Stage 4 · Above the clouds.
export const sky: StageDefinition = {
    id: 4,
    name: 'cloud-stage-four',
    length: STAGE_FOUR.length,
    goal: STAGE_FOUR.goal,
    terrain: [],
    // Saved by landing on platforms in the sky course, not by area.
    checkpoints: STAGE_FOUR.checkpoints.map(startMark),
    checkpointRule: 'pass',
    people: [],
    practicePile: false,
    alwaysUpright: true,
    newSkylineEachAttempt: false,
    finishAtGoal: false,
};

export const skyConfig = { stageFour: STAGE_FOUR };
