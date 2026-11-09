import type { Point } from './types';
import type { Message } from '../i18n';

export const TYPING_SOUNDS = ['typing.1', 'typing.2', 'typing.3', 'typing.4', 'typing.5'] satisfies Message[];
export type StageId = 1 | 2 | 3;
export type Furniture = { kind: 'chair'; x: number; y: number; width: number; height: number; vx: number; released: boolean; cheer: number };
export const STAGE_TWO = {
    length: 4000, goal: 3780,
    meeting: 620,
    lift: 3250,
    offices: [220, 1030, 1840, 2370],
    checkpoints: [{ x: 100, y: 392 }, { x: 1300, y: 392 }, { x: 2200, y: 392 }, { x: 3400, y: 392 }],
    terrain: [
        [{ x: -400, y: 420 }, { x: 4400, y: 420 }, { x: 4400, y: 800 }, { x: -400, y: 800 }],
    ] satisfies Point[][],
};
export type ChairChat = { kind: 'waiting' } | { kind: 'gossip' | 'wary' | 'dismissed' | 'realizing' | 'welcoming' | 'companions' | 'rush'; age: number };
export const CHAIR_CHAT = {
    rush: [
        { speaker: 0, text: 'chair.rush.1' },
        { speaker: 1, text: 'chair.rush.2' },
        { speaker: 2, text: 'chair.rush.3' },
    ],
    gossip: [
        { speaker: 2, text: 'chair.gossip.1' },
        { speaker: 1, text: 'chair.gossip.2' },
        { speaker: 0, text: 'chair.gossip.3' },
        { speaker: 2, text: 'chair.gossip.4' },
        { speaker: 1, text: 'chair.gossip.5' },
        { speaker: 0, text: 'chair.gossip.6' },
        { speaker: 2, text: 'chair.gossip.7' },
        { speaker: 1, text: 'chair.gossip.8' },
        { speaker: 0, text: 'chair.gossip.9' },
        { speaker: 2, text: 'chair.gossip.10' },
        { speaker: 1, text: 'chair.gossip.11' },
        { speaker: 0, text: 'chair.gossip.12' },
        { speaker: 2, text: 'chair.gossip.13' },
        { speaker: 1, text: 'chair.gossip.14' },
        { speaker: 0, text: 'chair.gossip.15' },
        { speaker: 2, text: 'chair.gossip.16' },
        { speaker: 1, text: 'chair.gossip.17' },
        { speaker: 0, text: 'chair.gossip.18' },
    ],
    wary: [{ speaker: 0, text: 'chair.wary.1' }],
    dismissed: [
        { speaker: 0, text: 'chair.dismissed.1' },
        { speaker: 1, text: 'chair.dismissed.2' },
        { speaker: 2, text: 'chair.dismissed.3' },
    ],
    realizing: [{ speaker: 1, text: 'chair.realizing.1' }],
    welcoming: [{ speaker: 2, text: 'chair.welcoming.1' }],
    companions: [
        { speaker: 0, text: 'chair.companions.1' },
        { speaker: 1, text: 'chair.companions.2' },
        { speaker: 2, text: 'chair.companions.3' },
        { speaker: 0, text: 'chair.companions.4' },
        { speaker: 1, text: 'chair.companions.5' },
        { speaker: 2, text: 'chair.companions.6' },
        { speaker: 0, text: 'chair.companions.7' },
        { speaker: 1, text: 'chair.companions.8' },
        { speaker: 2, text: 'chair.companions.9' },
        { speaker: 0, text: 'chair.companions.10' },
        { speaker: 1, text: 'chair.companions.11' },
        { speaker: 2, text: 'chair.companions.12' },
        { speaker: 0, text: 'chair.companions.13' },
        { speaker: 1, text: 'chair.companions.14' },
        { speaker: 2, text: 'chair.companions.15' },
        { speaker: 0, text: 'chair.companions.16' },
        { speaker: 1, text: 'chair.companions.17' },
        { speaker: 2, text: 'chair.companions.18' },
    ],
} satisfies Record<Exclude<ChairChat['kind'], 'waiting'>, { speaker: 0 | 1 | 2; text: Message }[]>;
export const CHAIR_CHAT_INTERVAL = { gossip: 3.2, wary: 4, dismissed: 1.9, realizing: 4, welcoming: 4, companions: 3.2, rush: 1.6 };
export function chairChatLine(chat: Exclude<ChairChat, { kind: 'waiting' }>, seed: number) {
    const lines = CHAIR_CHAT[chat.kind];
    const looping = chat.kind === 'gossip' || chat.kind === 'companions';
    const topic = looping ? Math.floor(seed / (chat.kind === 'companions' ? 7 : 1)) % (lines.length / 3) : 0;
    return lines[(topic * 3 + Math.floor(chat.age / CHAIR_CHAT_INTERVAL[chat.kind])) % lines.length];
}
export type ChairDepartureReason = 'companions' | 'clock-out' | 'abduction';
export type ChairDeparture = { kind: 'none' } | { kind: 'boarding' | 'descending'; age: number; reason: ChairDepartureReason } | { kind: 'gone' | 'lost' };
export const CHAIR_DEPARTURE = { boarding: 5, descending: 2, slots: [58, 0, -58] };
export const CHAIR_FAREWELL = [
    { speaker: 2, text: 'chair.farewell.1' },
    { speaker: 1, text: 'chair.farewell.2' },
    { speaker: 0, text: 'chair.farewell.3' },
    { speaker: 2, text: 'chair.farewell.4' },
] satisfies { speaker: 0 | 1 | 2; text: Message }[];
export const CHAIR_DEPARTURE_LINES = {
    abduction: [
        { speaker: 2, text: 'chair.abduction.1' },
        { speaker: 1, text: 'chair.abduction.2' },
        { speaker: 0, text: 'chair.abduction.3' },
        { speaker: 2, text: 'chair.abduction.4' },
    ],
    companions: CHAIR_FAREWELL,
    'clock-out': [
        { speaker: 2, text: 'chair.clockOut.1' },
        { speaker: 1, text: 'chair.clockOut.2' },
        { speaker: 0, text: 'chair.clockOut.3' },
        { speaker: 2, text: 'chair.clockOut.4' },
    ],
} satisfies Record<ChairDepartureReason, { speaker: 0 | 1 | 2; text: Message }[]>;
export type Corridor = {
    appearanceSeed: number;
    room: { kind: 'corridor' } | { kind: 'meeting'; age: number; returnX: number };
    meetingVisited: boolean;
    dispatchAge: number;
    dispatchStarted: boolean;
    chat: ChairChat;
    convoy: 'free' | 'carried' | 'airborne';
    pace: 'casual' | 'express';
    departure: ChairDeparture;
    lift: { kind: 'waiting' } | { kind: 'arriving'; age: number } | { kind: 'open'; age: number } | { kind: 'departed' };
    typingCooldown: number;
    offices: { x: number; life: number; cooldown: number; nearby: boolean; phrase: number; offset: Point }[];
};
export function createCorridor(checkpoint = 0): Corridor {
    const appearanceSeed = Math.floor(Math.random() * 0x100000000);
    return {
        appearanceSeed,
        room: { kind: 'corridor' }, meetingVisited: false,
        dispatchStarted: checkpoint > 0, dispatchAge: checkpoint > 0 ? 10 : 0,
        chat: { kind: 'waiting' },
        convoy: 'free',
        pace: 'casual',
        departure: { kind: checkpoint >= 3 ? 'gone' : 'none' },
        lift: { kind: checkpoint >= 3 ? 'departed' : 'waiting' },
        typingCooldown: 0,
        offices: STAGE_TWO.offices.map(x => ({ x, life: 0, cooldown: 0, nearby: false, phrase: 0, offset: { x: 0, y: 0 } })),
    };
}
export function createFurniture(checkpoint = 0): Furniture[] {
    const front = checkpoint > 0 ? STAGE_TWO.checkpoints[checkpoint].x + 190 : STAGE_TWO.meeting + 12;
    return [0, 1, 2].map(i => {
        const x = checkpoint > 0 ? front - i * 130 : front;
        return { kind: 'chair', x, y: 420, width: 48, height: 40, vx: checkpoint > 0 ? 185 : 0, released: checkpoint > 0, cheer: 0 };
    });
}
