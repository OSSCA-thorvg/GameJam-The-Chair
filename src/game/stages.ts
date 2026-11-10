import { FIXED_STEP, FOCUS_DAMAGE, LEVEL, RULES } from './level';
import { CHAIR_CHAT, CHAIR_CHAT_INTERVAL, CHAIR_DEPARTURE, CHAIR_DEPARTURE_LINES, STAGE_TWO, type StageId } from './stage2';
import { STAGE_THREE } from './stage3';
import { STAGE_FOUR } from './stage4';
import { polyRect } from './geometry';
import { configHash, deepFreeze } from './freeze';
import type { DeepReadonly, Person, Point } from './types';

// Where the chair must be for a checkpoint to save. x: [left, right), y: (top, bottom).
type Area = { left: number; right: number; top: number; bottom: number };
export type Checkpoint = Point & { area: Area };

// Static data for one stage. Stage-specific behaviour (copier, bin, convoy, fans, flight) stays in
// explicit `switch`/`if (stage)` calls in the step code; this table never holds callbacks.
export type StageDefinition = {
    id: StageId;
    name: 'office-stage-one' | 'building-stage-two' | 'rooftop-stage-three' | 'cloud-stage-four';
    length: number;
    goal: number;
    terrain: Point[][];
    // Index 0 is the stage start. A retry spawns at the last saved one.
    checkpoints: Checkpoint[];
    // 'pass' saves while moving through the area; 'land' needs the wheels on the ground there.
    checkpointRule: 'pass' | 'land';
    people: Person[];
};

const F = LEVEL.floor;
const start = (point: Point): Checkpoint => ({ ...point, area: { left: Infinity, right: Infinity, top: 0, bottom: 0 } });

const stages: Record<StageId, StageDefinition> = {
    1: {
        id: 1,
        name: 'office-stage-one',
        length: LEVEL.length,
        goal: LEVEL.goal,
        terrain: [
            polyRect(-400, F, LEVEL.bin.a + 400, 350),
            polyRect(LEVEL.bin.b, F, LEVEL.length - LEVEL.bin.b + 400, 350),
        ],
        checkpoints: [
            start({ x: 100, y: F - 28 }),
            // The safe approach before the bin.
            { x: 1400, y: F - 28, area: { left: 1400, right: LEVEL.bin.a - 25, top: -Infinity, bottom: Infinity } },
        ],
        checkpointRule: 'pass',
        people: [
            { id: 'manager', x: 320, said: false },
            { id: 'cleaner', x: LEVEL.cleaning.x + 55, said: false },
            { id: 'admin', x: 1810, said: false },
        ],
    },
    2: {
        id: 2,
        name: 'building-stage-two',
        length: STAGE_TWO.length,
        goal: STAGE_TWO.goal,
        terrain: STAGE_TWO.terrain.map(polygon => polygon.map(v => ({ ...v }))),
        checkpoints: STAGE_TWO.checkpoints.map((mark, i) => i === 0 ? start(mark)
            : { ...mark, area: { left: mark.x, right: Infinity, top: mark.y - 65, bottom: mark.y + 65 } }),
        checkpointRule: 'pass',
        people: [],
    },
    3: {
        id: 3,
        name: 'rooftop-stage-three',
        length: STAGE_THREE.length,
        goal: STAGE_THREE.goal,
        terrain: STAGE_THREE.terrain.map(polygon => polygon.map(v => ({ ...v }))),
        // Flying past a flag must not skip the course, so the rooftop saves only on a real landing.
        checkpoints: STAGE_THREE.checkpoints.map((mark, i) => i === 0 ? start(mark)
            : { ...mark, area: { left: mark.x - 90, right: mark.x + 90, top: mark.y - 35, bottom: mark.y + 35 } }),
        checkpointRule: 'land',
        people: [],
    },
    4: {
        id: 4,
        name: 'cloud-stage-four',
        length: STAGE_FOUR.length,
        goal: STAGE_FOUR.length,
        terrain: [],
        checkpoints: [start(STAGE_FOUR.spawn)],
        checkpointRule: 'pass',
        people: [],
    },
};

export const STAGES: DeepReadonly<Record<StageId, StageDefinition>> = deepFreeze(stages);

const pile = LEVEL.practicePaper;
// The paper pile used to practise the first jump in the office and the building.
export const PRACTICE_PILE: readonly Point[] = deepFreeze([
    { x: pile.x - pile.width / 2, y: F },
    { x: pile.x - 3, y: F - pile.height },
    { x: pile.x + 3, y: F - pile.height },
    { x: pile.x + pile.width / 2, y: F },
]);

export function stageSpawn(stage: StageId, checkpoint: number): Point {
    const marks = STAGES[stage].checkpoints;
    const mark = marks[Math.min(checkpoint, marks.length - 1)];
    return { x: mark.x, y: mark.y };
}

export function inCheckpointArea(mark: DeepReadonly<Checkpoint>, p: Point) {
    const { left, right, top, bottom } = mark.area;
    return p.x >= left && p.x < right && p.y > top && p.y < bottom;
}

// Everything that shapes a run besides state and commands. Replays record CONFIG_VERSION.
export const GAME_CONFIG = deepFreeze({
    fixedStep: FIXED_STEP,
    level: LEVEL,
    rules: RULES,
    focusDamage: FOCUS_DAMAGE,
    stages: STAGES,
    practicePile: PRACTICE_PILE,
    stageTwo: STAGE_TWO,
    stageThree: STAGE_THREE,
    stageFour: STAGE_FOUR,
    chair: { chat: CHAIR_CHAT, chatInterval: CHAIR_CHAT_INTERVAL, departure: CHAIR_DEPARTURE, departureLines: CHAIR_DEPARTURE_LINES },
});
export const CONFIG_VERSION = configHash(GAME_CONFIG);
