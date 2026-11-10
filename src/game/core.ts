import { LEVEL, RULES } from './level';
import { STAGE_THREE, type DuctBurst } from './stage3';
import { STAGE_FOUR } from './stage4';
import { STAGE_TWO, createFurniture, createCorridor, type Corridor, type StageId, type Furniture } from './stage2';
import { polyRect } from './geometry';
import type { GameEvent, Input, LossReason, Mode, Paper, Person, Player, Point, Snapshot } from './types';

export type FocusNotice = { kind: 'paper' | 'water' | 'light' | 'door'; life: number };
export type Impact = { frames: Snapshot[]; elapsed: number; point: Point };
export type Solid = { p: Point[]; practice?: true };

// Survives a restart. Only stage selection and checkpoints change it.
export type Progress = {
    stage: StageId;
    checkpoint: number;
    officeCheckpoint: boolean;
    lessons: { moved: boolean; jumped: boolean };
    deaths: number;
    completedStage: 0 | StageId;
    skylineSeed: number;
};

// Rebuilt from Progress on every attempt.
export type Attempt = {
    LEN: number;
    GOAL: number;
    hasExtinguisher: boolean;
    firstFlight: { kind: 'course'; verticalShots: number; lastShotAt: number } | { kind: 'flight'; age: number };
    rooftopEntrance: { kind: 'opening'; age: number } | { kind: 'ready' };
    ductReaction: { kind: 'idle' } | { kind: 'reacting'; age: number; shots: number; bursts: DuctBurst[] } | { kind: 'done'; shots: number };
    sprayCooldown: number;
    sprayBurst: number;
    sprayDir: { x: number; y: number };

    mode: Mode;
    p: Player;
    keys: Input[];
    ground: boolean;
    coyote: number;
    jumpQ: number;
    time: number;
    t: number;
    practiceJump: boolean;
    actualSpeed: number;

    furniture: Furniture[];
    corridor: Corridor;
    copier: { x: number; cool: number; burst: number; next: number; dir: number };
    cleaning: { x: number; a: number; b: number; spilled: boolean; age: number; followup: boolean; splashDir: number };
    bucket: { age: number; armed: boolean; spills: number };
    readonly bin: { x: number; a: number; b: number; rim: number };
    readonly parts: typeof LEVEL.playerContacts;

    papers: Paper[];
    people: Person[];
    solids: Solid[];
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

export type GameState = Progress & Attempt;
// `events` is the outgoing cue buffer, not game state; it is never serialized.
export type GameCore = GameState & { events: GameEvent[] };

export function createProgress(deaths = 0, completedStage: 0 | StageId = 0): Progress {
    return {
        stage: 1,
        checkpoint: 0,
        officeCheckpoint: false,
        lessons: { moved: false, jumped: false },
        deaths,
        completedStage,
        skylineSeed: Math.floor(Math.random() * 0x100000000),
    };
}

function stageSize(stage: StageId) {
    if (stage === 2) return { LEN: STAGE_TWO.length, GOAL: STAGE_TWO.goal };
    if (stage === 3) return { LEN: STAGE_THREE.length, GOAL: STAGE_THREE.goal };
    if (stage === 4) return { LEN: STAGE_FOUR.length, GOAL: STAGE_FOUR.length };
    return { LEN: LEVEL.length, GOAL: LEVEL.goal };
}

function stageLayout(progress: Progress, LEN: number): Pick<Attempt, 'solids' | 'people' | 'furniture'> {
    const F = LEVEL.floor;
    const copy = (terrain: readonly (readonly Point[])[]) => terrain.map(p => ({ p: p.map(v => ({ ...v })) }));
    if (progress.stage === 4) return { solids: [], people: [], furniture: [] };
    if (progress.stage === 3) return { solids: copy(STAGE_THREE.terrain), people: [], furniture: [] };
    if (progress.stage === 2) return { solids: copy(STAGE_TWO.terrain), people: [], furniture: createFurniture(progress.checkpoint) };
    return {
        solids: [
            { p: polyRect(-400, F, LEVEL.bin.a + 400, 350) },
            { p: polyRect(LEVEL.bin.b, F, LEN - LEVEL.bin.b + 400, 350) },
        ],
        people: [
            { id: 'manager', x: 320, said: false },
            { id: 'cleaner', x: LEVEL.cleaning.x + 55, said: false },
            { id: 'admin', x: 1810, said: false },
        ],
        furniture: createFurniture(),
    };
}

function spawnPoint(progress: Progress): Point {
    if (progress.stage === 4) return STAGE_FOUR.spawn;
    if (progress.stage === 3) return STAGE_THREE.checkpoints[progress.checkpoint];
    if (progress.stage === 2) return STAGE_TWO.checkpoints[progress.checkpoint];
    return { x: progress.officeCheckpoint ? 1400 : 100, y: LEVEL.floor - 28 };
}

export function createAttempt(progress: Progress, mode: Mode = 'play'): Attempt {
    const { stage, checkpoint } = progress;
    const size = stageSize(stage);
    return {
        ...size,
        hasExtinguisher: stage === 4 || (stage === 3 && checkpoint > 0),
        firstFlight: { kind: 'course', verticalShots: 0, lastShotAt: -1 },
        rooftopEntrance: stage === 3 && checkpoint === 0 ? { kind: 'opening', age: 0 } : { kind: 'ready' },
        ductReaction: { kind: 'idle' },
        sprayCooldown: 0,
        sprayBurst: stage === 4 ? .24 : 0,
        sprayDir: { x: 0, y: 1 },

        mode,
        p: { ...spawnPoint(progress), vx: 0, vy: 0, a: 0, w: 0 },
        keys: [],
        ground: false,
        coyote: 0,
        jumpQ: 0,
        time: 0,
        t: 0,
        practiceJump: false,
        actualSpeed: 0,

        ...stageLayout(progress, size.LEN),
        corridor: createCorridor(checkpoint),
        copier: { ...LEVEL.copier, cool: 0, burst: 0, next: 0, dir: -1 },
        cleaning: { ...LEVEL.cleaning, spilled: false, age: 0, followup: false, splashDir: 0 },
        bucket: { age: RULES.bucketReset, armed: true, spills: 0 },
        bin: { ...LEVEL.bin },
        parts: LEVEL.playerContacts,

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

export function createCore(progress: Progress): GameCore {
    return { ...progress, ...createAttempt(progress, 'intro'), events: [] };
}

export function progressOf(s: GameState): Progress {
    const { stage, checkpoint, officeCheckpoint, lessons, deaths, completedStage, skylineSeed } = s;
    return { stage, checkpoint, officeCheckpoint, lessons, deaths, completedStage, skylineSeed };
}

// Starts a new attempt from the current progress. The core object keeps its identity.
export function resetAttempt(s: GameCore) {
    if (s.stage === 1) s.skylineSeed = Math.floor(Math.random() * 0x100000000);
    Object.assign(s, createAttempt(progressOf(s)));
    s.events.length = 0;
    s.events.push({ type: 'reset' });
}

export function startStage(s: GameCore, id: StageId) {
    s.stage = id;
    s.checkpoint = 0;
    s.officeCheckpoint = false;
    s.lessons = { moved: false, jumped: false };
    resetAttempt(s);
}

export function serializeState(s: GameCore): string {
    const { events: _events, ...state } = s;
    return JSON.stringify(state);
}

export function restoreState(s: GameCore, json: string) {
    const state = JSON.parse(json) as GameState;
    for (const key of Object.keys(s) as (keyof GameCore)[]) {
        if (key !== 'events') delete (s as Partial<GameCore>)[key];
    }
    Object.assign(s, state, { parts: LEVEL.playerContacts });
    s.events.length = 0;
}

export function hasKey(s: GameState, input: Input) {
    return s.keys.includes(input);
}

export function clearKeys(s: GameState) {
    s.keys = [];
}

export function snapshot(s: GameState): Snapshot {
    return { p: { ...s.p } };
}

// re-exports used by systems
export { STAGE_TWO };
