// The stage table: static data only. Each stage defines itself in stages/<stage>/definition.ts;
// adding a stage adds one line here and one case in stages/hooks.ts and stages/attempt.ts.
import { FIXED_STEP, FOCUS_DAMAGE, LEVEL, PHYSICS, RULES } from '../level';
import { configHash, deepFreeze } from '../data';
import type { DeepReadonly, Point, StageId } from '../types';
import type { Checkpoint, StageDefinition } from './types';
import { office, officeConfig } from './office/definition';
import { building, buildingConfig } from './building/definition';
import { rooftop, rooftopConfig } from './rooftop/definition';
import { orbit, orbitConfig } from './orbit/definition';
import { sky, skyConfig } from './sky/definition';

export type { Checkpoint, StageDefinition, StageHooks } from './types';

export const STAGES: DeepReadonly<Record<StageId, StageDefinition>> = deepFreeze({ 1: office, 2: building, 3: rooftop, 4: sky, 5: orbit });

const F = LEVEL.floor;
const pile = LEVEL.practicePaper;
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
    // Which transcendental functions the core uses. 'deterministic-1' = src/game/math.ts (bit-exact in
    // every engine); replays recorded with the browser's own Math functions are flagged as another version.
    math: 'deterministic-1',
    fixedStep: FIXED_STEP,
    rules: RULES,
    physics: PHYSICS,
    focusDamage: FOCUS_DAMAGE,
    stages: STAGES,
    practicePile: PRACTICE_PILE,
    office: officeConfig,
    building: buildingConfig,
    rooftop: rooftopConfig,
    sky: skyConfig,
    orbit: orbitConfig,
});
export const CONFIG_VERSION = configHash(GAME_CONFIG);
