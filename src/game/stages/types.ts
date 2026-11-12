import type { Drive } from '../physics';
import type { GameState } from '../state';
import type { GameEvent, Person, Point, StageId } from '../types';

// Where the chair must be for a checkpoint to save. x: [left, right), y: (top, bottom).
export type Area = { left: number; right: number; top: number; bottom: number };
export type Checkpoint = Point & { area: Area };

/** A stage start or a flag saved by the stage's own rules: no area triggers it. */
export const startMark = (point: Point): Checkpoint => ({ ...point, area: { left: Infinity, right: Infinity, top: 0, bottom: 0 } });

// Static data for one stage, defined in stages/<stage>/definition.ts. No functions here: behaviour
// lives in the stage's hooks.ts and attempt.ts.
export type StageDefinition = {
    id: StageId;
    name: 'office-stage-one' | 'building-stage-two' | 'rooftop-stage-three' | 'cloud-stage-four' | 'orbit-stage-five';
    length: number;
    goal: number;
    terrain: Point[][];
    // Index 0 is the stage start. A retry spawns at the last saved one.
    checkpoints: Checkpoint[];
    // 'pass' saves while moving through the area; 'land' needs the wheels on the ground there.
    checkpointRule: 'pass' | 'land';
    people: Person[];
    // The paper pile for practising the first jump stays until that lesson is done.
    practicePile: boolean;
    // The chair rights itself everywhere, not only on the tutorial stretch.
    alwaysUpright: boolean;
    // Rolling past `goal` clears the stage. Stages that end in a scene clear themselves.
    finishAtGoal: boolean;
    // Draw a new city skyline outside the windows on every attempt.
    newSkylineEachAttempt: boolean;
};

/**
 * What a stage adds to the shared play step, in tick order. Every hook is optional.
 * Implemented in stages/<stage>/hooks.ts and picked with an explicit switch in stages/hooks.ts,
 * so editing one stage never touches another stage's file.
 */
export type StageHooks = {
    /** Counts down stage-only timers at the start of a tick. */
    timers?(s: GameState, dt: number): void;
    /** Scripted scenes that own the tick (door, take-off, meeting, lift, sky). True ends the tick. */
    takeover?(s: GameState, out: GameEvent[], dt: number): boolean;
    /** Hazards before driving. False when they ended play. */
    hazards?(s: GameState, out: GameEvent[], dt: number): boolean;
    /** Before the jump and wheel drive. `grounded` is whether the wheels were down. */
    beforeDrive?(s: GameState, out: GameEvent[], grounded: boolean): void;
    /** A jump has just started. */
    onJump?(s: GameState): void;
    /** Changes to wheel drive this tick (for example the chair convoy). */
    drive?(s: GameState, inputDir: number): Partial<Pick<Drive, 'dir' | 'slip' | 'convoyJump' | 'expressJump'>>;
    /** After moving and before collisions. True ends the tick. */
    afterMove?(s: GameState, out: GameEvent[], dt: number, previousX: number): boolean;
    /** After collisions. */
    afterCollide?(s: GameState, out: GameEvent[], dt: number, previousX: number): void;
    /** After the shared scoring cues, before the fall check (small effects such as wet-floor specks). */
    afterScore?(s: GameState, out: GameEvent[], dt: number): void;
    /** Whether flags can be saved now. Default: always. */
    checkpointsOpen?(s: GameState): boolean;
    /** Fell far below the floor. Default: count a death and restart from the last flag. */
    onFall?(s: GameState, out: GameEvent[]): void;
    /** Whether a jump command is accepted now. Default: yes. */
    canJump?(s: GameState): boolean;
    /** Whether the extinguisher can fire now (it must also be in hand). Default: yes. */
    canSpray?(s: GameState): boolean;
    /** A spray has fired; `direction` is the held left/right input. */
    onSpray?(s: GameState, direction: number): void;
    /** The interact command (Down): enter or leave a room. */
    interact?(s: GameState): void;
    /** The leave-meeting command. */
    leave?(s: GameState): void;
    /** Whether the interact command would do something now (shown as a hint). Default: no. */
    canInteract?(s: Readonly<GameState>): boolean;
    /** A stage distraction that pauses focus recovery (for example standing in spilled water). */
    focusBlocked?(s: Readonly<GameState>): boolean;
};
