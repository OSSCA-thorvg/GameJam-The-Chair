import type { Drive } from '../physics';
import type { CoreState } from '../state';
import type { GameEvent, Person, Point, StageId } from '../types';

// Where the chair must be for a checkpoint to save. x: [left, right), y: (top, bottom).
export type Area = { left: number; right: number; top: number; bottom: number };
export type Checkpoint = Point & { area: Area };

export const startMark = (point: Point): Checkpoint => ({ ...point, area: { left: Infinity, right: Infinity, top: 0, bottom: 0 } });

export type StageDefinition = {
    id: StageId;
    name: 'office-stage-one' | 'building-stage-two' | 'rooftop-stage-three' | 'cloud-stage-four' | 'orbit-stage-five';
    length: number;
    goal: number;
    terrain: Point[][];
    checkpoints: Checkpoint[];
    checkpointRule: 'pass' | 'land';
    people: Person[];
    practicePile: boolean;
    alwaysUpright: boolean;
    finishAtGoal: boolean;
    newSkylineEachAttempt: boolean;
};

export type StageHooks = {
    timers?(s: CoreState, dt: number): void;
    takeover?(s: CoreState, out: GameEvent[], dt: number): boolean;
    hazards?(s: CoreState, out: GameEvent[], dt: number): boolean;
    beforeDrive?(s: CoreState, out: GameEvent[], grounded: boolean): void;
    onJump?(s: CoreState): void;
    drive?(s: CoreState, inputDir: number): Partial<Pick<Drive, 'dir' | 'slip' | 'convoyJump' | 'expressJump'>>;
    afterMove?(s: CoreState, out: GameEvent[], dt: number, previousX: number): boolean;
    afterCollide?(s: CoreState, out: GameEvent[], dt: number, previousX: number): void;
    afterScore?(s: CoreState, out: GameEvent[], dt: number): void;
    checkpointsOpen?(s: CoreState): boolean;
    onFall?(s: CoreState, out: GameEvent[]): void;
    canJump?(s: CoreState): boolean;
    canSpray?(s: CoreState): boolean;
    onSpray?(s: CoreState, direction: number): void;
    interact?(s: CoreState): void;
    leave?(s: CoreState): void;
    canInteract?(s: Readonly<CoreState>): boolean;
    focusBlocked?(s: Readonly<CoreState>): boolean;
};
