import { LEVEL, RULES } from './level';
import type { FocusNotice } from './systems/focus/decide';
import type { Impact } from './systems/impact/decide';
import type { SkyState } from './stages/sky/data';
import type { OfficeState } from './stages/office/state';
import type { BuildingState } from './stages/building/state';
import type { RooftopState } from './stages/rooftop/state';
import { STAGES, stageSpawn } from './stages/index';
import { createStageStates, prepareStageAttempt } from './stages/attempt';
import { clonePlain } from './data';
import { randomUint32, seedRng, type Rng } from './rng';
import type { GameEvent, Input, LossReason, Mode, Paper, Person, Player, Snapshot, StageId } from './types';
import { assertGameState } from './validation';


// Survives a restart. Only stage selection and checkpoints change it.
export type Progress = {
    stage: StageId;
    // Index into STAGES[stage].checkpoints. 0 is the stage start.
    checkpoint: number;
    lessons: { moved: boolean; jumped: boolean };
    deaths: number;
    completedStage: 0 | StageId;
    skylineSeed: number;
    // Fixed steps simulated since the game was created. Never resets, so recorded commands stay ordered.
    tick: number;
};

// Rebuilt from Progress on every attempt.
export type Attempt = {
    rng: Rng;
    // Equipment and spray, shared by the stages that use the extinguisher.
    hasExtinguisher: boolean;
    sprayCooldown: number;
    sprayBurst: number;
    sprayDir: { x: number; y: number };

    mode: Mode;
    p: Player;
    keys: Input[];
    ground: boolean;
    coyote: number;
    jumpQ: number;
    // Seconds simulated in this attempt (fixed steps only).
    time: number;
    practiceJump: boolean;
    actualSpeed: number;
    rollCooldown: number;
    reverseCooldown: number;

    people: Person[];
    history: Snapshot[];
    impact: Impact | null;

    focus: number;
    focusClock: number;
    focusEvents: string[];
    focusNotice: FocusNotice | null;
    lossReason: LossReason | null;
    focusLossTime: number;

    // Each stage's own values, defined in stages/<stage>/state.ts. All four exist in every attempt;
    // only the current stage changes its own.
    office: OfficeState;
    building: BuildingState;
    rooftop: RooftopState;
    sky: SkyState;
};

// Everything that decides how play continues. Plain JSON: save it and restore it to resume exactly.
export type GameState = Progress & Attempt;

function createProgress(skylineSeed: number, deaths = 0, completedStage: 0 | StageId = 0): Progress {
    return {
        stage: 1,
        checkpoint: 0,
        lessons: { moved: false, jumped: false },
        deaths,
        completedStage,
        skylineSeed,
        tick: 0,
    };
}

export function createAttempt(progress: Progress, seed: Rng, mode: Mode = 'play'): Attempt {
    const { stage, checkpoint } = progress;
    const rng = { ...seed };
    const appearanceSeed = randomUint32(rng, 'cosmetic');
    const attempt: Attempt = {
        rng,
        hasExtinguisher: false,
        sprayCooldown: 0,
        sprayBurst: 0,
        sprayDir: { x: 0, y: 1 },

        mode,
        p: { ...stageSpawn(stage, checkpoint), vx: 0, vy: 0, a: 0, w: 0 },
        keys: [],
        ground: false,
        coyote: 0,
        jumpQ: 0,
        time: 0,
        practiceJump: false,
        actualSpeed: 0,
        rollCooldown: 0,
        reverseCooldown: 0,

        people: STAGES[stage].people.map(person => ({ ...person })),
        history: [],
        impact: null,

        focus: 100,
        focusClock: 0,
        focusEvents: [],
        focusNotice: null,
        lossReason: null,
        focusLossTime: 0,

        ...createStageStates(checkpoint, appearanceSeed),
    };

    // Stage-specific starting values live with each stage (stages/<stage>/attempt.ts).
    prepareStageAttempt(stage, attempt, checkpoint);
    return attempt;
}

export type CoreOptions = { seed: number; deaths?: number; completedStage?: 0 | StageId };

export function createCore({ seed, deaths, completedStage }: CoreOptions): GameState {
    const rng = seedRng(seed);
    const progress = createProgress(randomUint32(rng, 'cosmetic'), deaths, completedStage);
    return { ...progress, ...createAttempt(progress, rng, 'intro') };
}

export function progressOf(s: GameState): Progress {
    const { stage, checkpoint, lessons, deaths, completedStage, skylineSeed, tick } = s;
    return { stage, checkpoint, lessons, deaths, completedStage, skylineSeed, tick };
}

// Starts a new attempt from the current progress. The core object keeps its identity.
export function resetAttempt(s: GameState, out: GameEvent[]) {
    // Some stages show a fresh skyline on every attempt; the others keep theirs.
    if (STAGES[s.stage].newSkylineEachAttempt) s.skylineSeed = randomUint32(s.rng, 'cosmetic');
    Object.assign(s, createAttempt(progressOf(s), s.rng));
    out.push({ type: 'reset' });
}

export function startStage(s: GameState, id: StageId, out: GameEvent[]) {
    s.stage = id;
    s.checkpoint = 0;
    s.lessons = { moved: false, jumped: false };
    resetAttempt(s, out);
}

export function serializeState(s: GameState): string {
    return JSON.stringify(s);
}

export function parseState(json: string): GameState {
    const value: unknown = JSON.parse(json);
    assertGameState(value);
    return value;
}

// Rewind frames are frozen: once recorded they are shared between states, never copied or edited.
export function snapshot(s: GameState): Snapshot {
    return Object.freeze({ p: Object.freeze({ ...s.p }) }) as Snapshot;
}

// Copy for the pure step. Plain recursive copy is several times faster than structuredClone here,
// and the rewind history (most of the state) shares its frozen frames.
export function cloneState(s: Readonly<GameState>): GameState {
    const { history, ...rest } = s;
    const copy = clonePlain(rest) as GameState;
    copy.history = history.slice();
    return copy;
}

// Player updates keep the same object: the play step holds a reference to it for the whole tick.
export function setPlayer(s: GameState, p: Readonly<GameState['p']>) {
    Object.assign(s.p, p);
}
