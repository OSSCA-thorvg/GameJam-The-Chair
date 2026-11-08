import { LEVEL, RULES } from './level';
import { STAGE_TWO, createFurniture, createCorridor, type Corridor, type StageId, type Furniture } from './stage2';
import type { GameEvent, Input, Paper, Person, Player, Point, Snapshot } from './types';

export type FocusNotice = { kind: 'paper' | 'water' | 'light' | 'door' | 'cart'; life: number };
export type Impact = { frames: Snapshot[]; elapsed: number; point: Point };
export type Solid = { p: Point[]; practice?: true };

export type GameCore = {
    stage: StageId;
    LEN: number;
    GOAL: number;
    checkpoint: number;
    officeCheckpoint: boolean;
    skylineSeed: number;
    lessons: { moved: boolean; jumped: boolean };
    sprayAmmo: number;
    sprayCooldown: number;
    sprayCharge: number;
    sprayBurst: number;
    sprayDir: { x: number; y: number };
    onFan: boolean;
    deaths: number;

    mode: string;
    p: Player;
    keys: Set<Input>;
    ground: boolean;
    coyote: number;
    jumpQ: number;
    time: number;
    t: number;
    acc: number;
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
    focusEvents: Set<string>;
    focusNotice: FocusNotice | null;
    volley: number;
    lossReason: string | null;
    focusLossTime: number;

    events: GameEvent[];
};

export function createCore(initialDeaths: number): GameCore {
    const F = LEVEL.floor;
    return {
        stage: 1,
        LEN: LEVEL.length,
        GOAL: LEVEL.goal,
        checkpoint: 0,
        officeCheckpoint: false,
        skylineSeed: Math.floor(Math.random() * 0x100000000),
        lessons: { moved: false, jumped: false },
        sprayAmmo: 4,
        sprayCooldown: 0,
        sprayCharge: 0,
        sprayBurst: 0,
        sprayDir: { x: 0, y: 1 },
        onFan: false,
        deaths: initialDeaths,

        mode: 'intro',
        p: { x: 100, y: F - 28, vx: 0, vy: 0, a: 0, w: 0 },
        keys: new Set<Input>(),
        ground: false,
        coyote: 0,
        jumpQ: 0,
        time: 0,
        t: 0,
        acc: 0,
        practiceJump: false,
        actualSpeed: 0,

        furniture: createFurniture(),
        corridor: createCorridor(),
        copier: { ...LEVEL.copier, cool: 0, burst: 0, next: 0, dir: -1 },
        cleaning: { ...LEVEL.cleaning, spilled: false, age: 0, followup: false, splashDir: 0 },
        bucket: { age: RULES.bucketReset, armed: true, spills: 0 },
        bin: { ...LEVEL.bin },
        parts: LEVEL.playerContacts,

        papers: [],
        people: [],
        solids: [],
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
        focusEvents: new Set<string>(),
        focusNotice: null,
        volley: 0,
        lossReason: null,
        focusLossTime: 0,

        events: [],
    };
}

export function snapshot(s: GameCore): Snapshot {
    return { p: { ...s.p } };
}

// re-exports used by systems
export { STAGE_TWO };
