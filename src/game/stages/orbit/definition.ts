import { startMark, type StageDefinition } from '../types';
import { STAGE_FIVE } from './data';

export const orbit: StageDefinition = {
    id: 5, name: 'orbit-stage-five', length: STAGE_FIVE.length, goal: STAGE_FIVE.goal,
    terrain: [], checkpoints: [startMark({ x: 0, y: 0 }), ...STAGE_FIVE.restarts.map(() => startMark({ x: 0, y: 0 })), startMark(STAGE_FIVE.checkpoint)],
    checkpointRule: 'pass', people: [], practicePile: false, alwaysUpright: true,
    finishAtGoal: false, newSkylineEachAttempt: false,
};

export const orbitConfig = { stageFive: STAGE_FIVE };
