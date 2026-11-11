import { startMark, type StageDefinition } from '../types';
import { STAGE_THREE } from './data';

// Stage 3 · Mechanical room and rooftop.
export const rooftop: StageDefinition = {
    id: 3,
    name: 'rooftop-stage-three',
    length: STAGE_THREE.length,
    goal: STAGE_THREE.goal,
    terrain: STAGE_THREE.terrain.map(polygon => polygon.map(v => ({ ...v }))),
    // Flying past a flag must not skip the course, so the rooftop saves only on a real landing.
    checkpoints: STAGE_THREE.checkpoints.map((mark, i) => i === 0 ? startMark(mark)
        : { ...mark, area: { left: mark.x - 90, right: mark.x + 90, top: mark.y - 35, bottom: mark.y + 35 } }),
    checkpointRule: 'land',
    people: [],
    practicePile: false,
    alwaysUpright: true,
    newSkylineEachAttempt: false,
    finishAtGoal: false,
};

export const rooftopConfig = { stageThree: STAGE_THREE };
