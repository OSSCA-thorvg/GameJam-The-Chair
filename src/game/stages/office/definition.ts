import { polyRect } from '../../geometry';
import { LEVEL } from '../../level';
import { startMark } from '../types';

import type { StageDefinition } from '../types';

const F = LEVEL.floor;

export const office: StageDefinition = {
    id: 1,
    name: 'office-stage-one',
    length: LEVEL.length,
    goal: LEVEL.goal,
    terrain: [
        polyRect(-400, F, LEVEL.bin.a + 400, 350),
        polyRect(LEVEL.bin.b, F, LEVEL.length - LEVEL.bin.b + 400, 350),
    ],
    checkpoints: [
        startMark({ x: 100, y: F - 28 }),
        {
            x: 1400,
            y: F - 28,
            area: {
                left: 1400,
                right: LEVEL.bin.a - 25,
                top: -Infinity,
                bottom: Infinity,
            },
        },
    ],
    checkpointRule: 'pass',
    people: [
        { id: 'manager', x: 320, said: false },
        { id: 'cleaner', x: LEVEL.cleaning.x + 55, said: false },
        { id: 'admin', x: 1810, said: false },
    ],
    practicePile: true,
    alwaysUpright: false,
    newSkylineEachAttempt: true,
    finishAtGoal: true,
};

export const officeConfig = { level: LEVEL };
