import type { FocusState } from './systems/focus/decide';
import type { Impact } from './systems/impact/decide';
import type { OrbitState } from './stages/orbit/state';
import type { SkyState } from './stages/sky/data';
import type { OfficeState } from './stages/office/state';
import type { BuildingState } from './stages/building/state';
import type { RooftopState } from './stages/rooftop/state';
import { STAGES, stageSpawn } from './stages/index';
import { createStageStates, prepareStageAttempt } from './stages/attempt';
import { clonePlain } from './data';
import { randomUint32, seedRng, type Rng } from './rng';
import type { GameEvent, Input, LossReason, Mode, Person, Player, Snapshot, StageId } from './types';
import { assertGameState } from './validation';


// Survives a restart.
export type Progress = {
    stage: StageId;
    // Index into STAGES[stage].checkpoints. Starts at 0.
    checkpoint: number;
    lessons: { moved: boolean; jumped: boolean };
    deaths: number;
    completedStage: 0 | StageId;
    skylineSeed: number;
    // Never resets: recorded commands are ordered by this tick.
    tick: number;
};

export type ExtinguisherState = {
    owned: boolean;
    cooldown: number;
    burst: number;
    direction: { x: number; y: number };
};

export type Attempt = {
    rng: Rng;
    extinguisher: ExtinguisherState;

    mode: Mode;
    /** Player body; this key is persisted in existing replays. */
    p: Player;
    keys: Input[];
    ground: boolean;
    coyote: number;
    /** Remaining jump buffer in seconds; the key is persisted in existing replays. */
    jumpQ: number;
    time: number;
    practiceJump: boolean;
    actualSpeed: number;
    rollCooldown: number;
    reverseCooldown: number;

    people: Person[];
    history: Snapshot[];
    impact: Impact | null;

    focus: FocusState;
    lossReason: LossReason | null;
    focusLossTime: number;

    office: OfficeState;
    building: BuildingState;
    rooftop: RooftopState;
    sky: SkyState;
    orbit: OrbitState;
};

export type CoreState = Progress & Attempt;

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
        extinguisher: { owned: false, cooldown: 0, burst: 0, direction: { x: 0, y: 1 } },

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

        focus: { value: 100, recoveryClock: 0, processedEvents: [], notice: null },
        lossReason: null,
        focusLossTime: 0,

        ...createStageStates(checkpoint, appearanceSeed),
    };

    prepareStageAttempt(stage, attempt, checkpoint);
    return attempt;
}

export type CoreOptions = { seed: number; deaths?: number; completedStage?: 0 | StageId };

export function createCore({ seed, deaths, completedStage }: CoreOptions): CoreState {
    const rng = seedRng(seed);
    const progress = createProgress(randomUint32(rng, 'cosmetic'), deaths, completedStage);
    return { ...progress, ...createAttempt(progress, rng, 'intro') };
}

export function progressOf(s: CoreState): Progress {
    const { stage, checkpoint, lessons, deaths, completedStage, skylineSeed, tick } = s;
    return { stage, checkpoint, lessons, deaths, completedStage, skylineSeed, tick };
}

export function resetAttempt(s: CoreState, out: GameEvent[]) {
    if (STAGES[s.stage].newSkylineEachAttempt) s.skylineSeed = randomUint32(s.rng, 'cosmetic');
    Object.assign(s, createAttempt(progressOf(s), s.rng));
    out.push({ type: 'reset' });
}

export function startStage(s: CoreState, id: StageId, out: GameEvent[]) {
    s.stage = id;
    s.checkpoint = 0;
    s.lessons = { moved: false, jumped: false };
    resetAttempt(s, out);
}

export function serializeState(s: CoreState): string {
    return JSON.stringify(s);
}

export function parseState(json: string): CoreState {
    const value: unknown = JSON.parse(json);
    assertGameState(value);
    return value;
}

// Frozen rewind frames are shared between states; never mutate them.
export function snapshot(s: CoreState): Snapshot {
    return Object.freeze({ p: Object.freeze({ ...s.p }) }) as Snapshot;
}

export function cloneState(s: Readonly<CoreState>): CoreState {
    const { history, ...rest } = s;
    const copy = clonePlain(rest) as CoreState;
    copy.history = history.slice();
    return copy;
}

// Preserve player identity: the play step holds this reference throughout the tick.
export function setPlayer(s: CoreState, p: Readonly<CoreState['p']>) {
    Object.assign(s.p, p);
}
