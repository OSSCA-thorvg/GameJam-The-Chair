import { startMark, type StageDefinition } from '../types';
import { CHAIR_CHAT, CHAIR_CHAT_INTERVAL, CHAIR_DEPARTURE, CHAIR_DEPARTURE_LINES, STAGE_TWO } from './data';

export const building: StageDefinition = {
    id: 2,
    name: 'building-stage-two',
    length: STAGE_TWO.length,
    goal: STAGE_TWO.goal,
    terrain: STAGE_TWO.terrain.map(polygon => polygon.map(v => ({ ...v }))),
    checkpoints: STAGE_TWO.checkpoints.map((mark, i) => i === 0 ? startMark(mark)
        : { ...mark, area: { left: mark.x, right: Infinity, top: mark.y - 65, bottom: mark.y + 65 } }),
    checkpointRule: 'pass',
    people: [],
    practicePile: true,
    alwaysUpright: false,
    newSkylineEachAttempt: false,
    finishAtGoal: true,
};

export const buildingConfig = {
    stageTwo: STAGE_TWO,
    chair: { chat: CHAIR_CHAT, chatInterval: CHAIR_CHAT_INTERVAL, departure: CHAIR_DEPARTURE, departureLines: CHAIR_DEPARTURE_LINES },
};
