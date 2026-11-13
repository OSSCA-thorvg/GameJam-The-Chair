export type Point = {
    x: number;
    y: number;
};
export type Player = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    a: number;
    w: number;
};
export type Snapshot = {
    p: Player;
};
export type Person = {
    id: 'manager' | 'cleaner' | 'admin';
    x: number;
    said: boolean;
};
export type Paper = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    a: number;
    w: number;
    life: number;
    hit: boolean;
    landed: boolean;
    volley: number;
    safe: boolean;
    // A stapled bundle of reports is bigger, heavier and shoves the chair back.
    kind: 'sheet' | 'bundle';
};
export type Input = 'left' | 'right' | 'q' | 'e' | 'spray' | 'forward' | 'back' | 'brake';
export type DeepReadonly<T> = T extends object ? {
    readonly [K in keyof T]: DeepReadonly<T[K]>;
} : T;
export type CueId = 'lift-game-over' | 'practice-cleared' | 'checkpoint' | 'head-hit' | 'head-comment' | 'head-game-over' | 'first-volley' | 'paper-hit' | 'water-spilled' | 'water-comment' | 'water-followup' | 'bin-fall' | 'bin-comment' | 'bin-game-over' | 'focus-lost' | 'focus-game-over' | 'slipping' | 'rolling' | 'reverse-comment' | 'person-comment' | 'stage-clear' | 'light-hit' | 'light-comment' | 'spray' | 'extinguisher-pickup' | 'urgent-volley' | 'bundle-hit' | 'convoy-bump' | 'gear-hit';
export type GameEvent = {
    type: 'cue';
    id: Exclude<CueId, 'light-comment'>;
    person?: Person;
} | {
    type: 'cue';
    id: 'light-comment';
    monitorIndex: number;
    person?: never;
} | {
    type: 'reset';
} | {
    type: 'tick';
    dt: number;
} | {
    type: 'particles-step';
    dt: number;
} | {
    type: 'water-step';
    dt: number;
} | {
    type: 'water-splash';
    x: number;
    side: number;
} | {
    type: 'speck';
    x: number;
    vx: number;
} | {
    type: 'volley';
} | {
    type: 'light-contact';
};
export type Mode = 'intro' | 'play' | 'pause' | 'impact' | 'focuslost' | 'dead' | 'won';
export type LossReason = 'head' | 'bin' | 'focus' | 'lift';
export type StageId = 1 | 2 | 3 | 4 | 5;
