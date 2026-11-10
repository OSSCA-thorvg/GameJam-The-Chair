import { LEVEL, RULES } from './level';
import type { FocusNotice } from './systems/focus';
import type { Impact } from './systems/impact';
import type { DuctReaction, FirstFlight, RooftopEntrance } from './systems/rooftop';
import { createSky, type SkyState } from './stage4';
import { createFurniture, createCorridor, type Corridor, type StageId, type Furniture } from './stage2';
import { STAGES, stageSpawn } from './stages';
import { clonePlain } from './data';
import { randomUint32, seedRng, type Rng } from './rng';
import type { GameEvent, Input, LossReason, Mode, Paper, Person, Player, Snapshot } from './types';


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
    sky: SkyState;
    hasExtinguisher: boolean;
    firstFlight: FirstFlight;
    rooftopEntrance: RooftopEntrance;
    ductReaction: DuctReaction;
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

    furniture: Furniture[];
    corridor: Corridor;
    copier: { x: number; cool: number; burst: number; next: number; dir: number };
    cleaning: { x: number; a: number; b: number; spilled: boolean; age: number; followup: boolean; splashDir: number };
    bucket: { age: number; armed: boolean; spills: number };

    papers: Paper[];
    people: Person[];
    history: Snapshot[];
    impact: Impact | null;

    dirty: boolean;
    inBin: boolean;
    binAge: number;
    binCooldown: number;
    escapeQueued: boolean;
    slip: boolean;
    wetSeen: boolean;
    slipCooldown: number;
    paperPenaltyRemaining: number;
    paperHits: number;
    bursts: number;
    binFalls: number;
    rollCooldown: number;
    reverseCooldown: number;
    soakedOnSpill: number;
    lightPenaltyRemaining: number;
    lightHits: number;
    doorHits: number;
    lightCooldown: number;

    focus: number;
    focusClock: number;
    focusEvents: string[];
    focusNotice: FocusNotice | null;
    volley: number;
    lossReason: LossReason | null;
    focusLossTime: number;
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

function stageFurniture(stage: StageId, checkpoint: number): Furniture[] {
    if (stage === 2) return createFurniture(checkpoint);
    return stage === 1 ? createFurniture() : [];
}

export function createAttempt(progress: Progress, seed: Rng, mode: Mode = 'play'): Attempt {
    const { stage, checkpoint } = progress;
    const rng = { ...seed };
    const appearanceSeed = randomUint32(rng, 'cosmetic');
    const sky = createSky();
    // A sky retry after the first flag resumes with the building already grown.
    if (stage === 4 && checkpoint > 0) { sky.phase = 'course'; sky.lift = 1; }
    return {
        rng,
        sky,
        hasExtinguisher: stage === 4 || (stage === 3 && checkpoint > 0),
        firstFlight: { kind: 'course', verticalShots: 0, lastShotAt: -1 },
        rooftopEntrance: stage === 3 && checkpoint === 0 ? { kind: 'opening', age: 0 } : { kind: 'ready' },
        ductReaction: { kind: 'idle' },
        sprayCooldown: 0,
        sprayBurst: stage === 4 ? .24 : 0,
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

        people: STAGES[stage].people.map(person => ({ ...person })),
        furniture: stageFurniture(stage, checkpoint),
        corridor: createCorridor(checkpoint, appearanceSeed),
        copier: { ...LEVEL.copier, cool: 0, burst: 0, next: 0, dir: -1 },
        cleaning: { ...LEVEL.cleaning, spilled: false, age: 0, followup: false, splashDir: 0 },
        bucket: { age: RULES.bucketReset, armed: true, spills: 0 },

        papers: [],
        history: [],
        impact: null,

        dirty: false,
        inBin: false,
        binAge: 0,
        binCooldown: 0,
        escapeQueued: false,
        slip: false,
        wetSeen: false,
        slipCooldown: 0,
        paperPenaltyRemaining: 0,
        paperHits: 0,
        bursts: 0,
        binFalls: 0,
        rollCooldown: 0,
        reverseCooldown: 0,
        soakedOnSpill: 0,
        lightPenaltyRemaining: 0,
        lightHits: 0,
        doorHits: 0,
        lightCooldown: 0,

        focus: 100,
        focusClock: 0,
        focusEvents: [],
        focusNotice: null,
        volley: 0,
        lossReason: null,
        focusLossTime: 0,
    };
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
    // The office skyline changes on every office attempt; later stages keep theirs.
    if (s.stage === 1) s.skylineSeed = randomUint32(s.rng, 'cosmetic');
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
    return JSON.parse(json) as GameState;
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
