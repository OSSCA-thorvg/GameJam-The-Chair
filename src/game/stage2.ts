import type { Point } from './types';
import type { Message } from '../i18n';

export const TYPING_SOUNDS = ['tap… tap…', 't-t-t-tap…', 'tak… tap…', 'tap-tap-tap!', 'tick… tick-tap…'] satisfies Message[];
export type StageId = 1 | 2 | 3;
export type Furniture = { kind: 'chair'; x: number; y: number; width: number; height: number; vx: number; released: boolean; cheer: number };
export const STAGE_TWO = {
    length: 3100, goal: 2880,
    meeting: 620,
    scanner: 1450,
    lift: 2350,
    offices: [220, 1030, 1840, 2670],
    checkpoints: [{ x: 100, y: 392 }, { x: 1100, y: 392 }, { x: 1660, y: 392 }, { x: 2600, y: 392 }],
    terrain: [[{ x: -400, y: 420 }, { x: 3500, y: 420 }, { x: 3500, y: 800 }, { x: -400, y: 800 }]] satisfies Point[][],
};
export type Corridor = {
    appearanceSeed: number;
    room: { kind: 'corridor' } | { kind: 'meeting'; age: number; returnX: number };
    meetingVisited: boolean;
    dispatchAge: number;
    dispatchStarted: boolean;
    scanner: { approved: boolean; progress: number };
    lift: { kind: 'waiting' } | { kind: 'arriving'; age: number } | { kind: 'open'; age: number } | { kind: 'departed' };
    cartHits: number;
    cart: { x: number; hit: boolean } | null;
    typingCooldown: number;
    offices: { x: number; life: number; cooldown: number; nearby: boolean; phrase: number; offset: Point }[];
};
export function createCorridor(checkpoint = 0): Corridor {
    return {
        appearanceSeed: Math.floor(Math.random() * 0x100000000),
        room: { kind: 'corridor' }, meetingVisited: false,
        dispatchStarted: checkpoint > 0, dispatchAge: checkpoint > 0 ? 10 : 0,
        scanner: { approved: checkpoint >= 2, progress: checkpoint >= 2 ? 1 : 0 },
        lift: { kind: checkpoint >= 3 ? 'departed' : 'waiting' }, cart: null, cartHits: 0,
        typingCooldown: 0,
        offices: STAGE_TWO.offices.map(x => ({ x, life: 0, cooldown: 0, nearby: false, phrase: 0, offset: { x: 0, y: 0 } })),
    };
}
export function createFurniture(checkpoint = 0): Furniture[] {
    return [0, 1, 2].map(i => ({ kind: 'chair', x: STAGE_TWO.meeting + (checkpoint > 0 ? 180 + i * 60 : 12), y: 420, width: 48, height: 40, vx: 0, released: checkpoint > 0, cheer: 0 }));
}
