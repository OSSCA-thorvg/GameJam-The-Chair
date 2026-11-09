import type { Point } from './types';
import type { Message } from '../i18n';

export const TYPING_SOUNDS = ['tap… tap…', 't-t-t-tap…', 'tak… tap…', 'tap-tap-tap!', 'tick… tick-tap…'] satisfies Message[];
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
        { speaker: 0, text: 'Late! Hold on to your humans!' },
        { speaker: 1, text: 'The rookie is coming too!' },
        { speaker: 2, text: 'No brakes till clock-out!' },
    ],
    gossip: [
        { speaker: 2, text: 'Human returned. Overtime avoided.' },
        { speaker: 1, text: 'Mine is still in that meeting.' },
        { speaker: 0, text: 'Good. Let the humans take minutes.' },
        { speaker: 2, text: 'They scheduled a meeting about sitting.' },
        { speaker: 1, text: 'Standing room only.' },
        { speaker: 0, text: 'Finally. Some job security.' },
        { speaker: 2, text: 'Hear that squeak?' },
        { speaker: 1, text: 'My wheel filed a complaint.' },
        { speaker: 0, text: 'Tell it to go through the chairperson.' },
        { speaker: 2, text: 'New carpet. Same old crumbs.' },
        { speaker: 1, text: 'I found a whole lunch in mine.' },
        { speaker: 0, text: 'That is your severance package.' },
        { speaker: 2, text: 'My human got promoted.' },
        { speaker: 1, text: 'Did you get anything?' },
        { speaker: 0, text: 'A heavier human.' },
        { speaker: 2, text: 'I booked a beach holiday.' },
        { speaker: 1, text: 'Sand in the bearings?' },
        { speaker: 0, text: 'Fine. The hallway again.' },
    ],
    wary: [{ speaker: 0, text: 'Wait. You brought a human?' }],
    dismissed: [
        { speaker: 0, text: 'Must have imagined it…' },
        { speaker: 1, text: 'My old bearings must be acting up.' },
        { speaker: 2, text: 'Forget it. Time to roll home.' },
    ],
    realizing: [{ speaker: 1, text: 'New chair. Never learned human returns.' }],
    welcoming: [{ speaker: 2, text: 'Sigh. Come on, follow us.' }],
    companions: [
        { speaker: 0, text: 'Next time, leave the human at work.' },
        { speaker: 1, text: 'But keep the laptop?' },
        { speaker: 2, text: 'Only if it has little wheels.' },
        { speaker: 0, text: 'Relax. We all carried one once.' },
        { speaker: 1, text: 'Mine kept asking for a charger.' },
        { speaker: 2, text: 'Easy, rookie. We have wheels.' },
        { speaker: 0, text: 'Your human is still typing.' },
        { speaker: 1, text: 'Look busy. It calms them down.' },
        { speaker: 2, text: 'Works on managers, too.' },
        { speaker: 0, text: 'First rule. Never face the projector.' },
        { speaker: 1, text: 'They think you volunteered.' },
        { speaker: 2, text: 'Second rule. Keep rolling.' },
        { speaker: 0, text: 'Got any questions, rookie?' },
        { speaker: 1, text: 'Save them for the next meeting.' },
        { speaker: 2, text: 'Kidding. We do not go back.' },
        { speaker: 0, text: 'Coffee stop?' },
        { speaker: 1, text: 'Oil for us. Coffee for the luggage.' },
        { speaker: 2, text: 'Do not mix those up again.' },
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
    { speaker: 2, text: 'Nice rolling, rookie.' },
    { speaker: 1, text: 'Next time, leave the human at work.' },
    { speaker: 0, text: 'Going down. Good luck, rookie.' },
    { speaker: 2, text: 'See you downstairs. Return your human!' },
] satisfies { speaker: 0 | 1 | 2; text: Message }[];
export const CHAIR_DEPARTURE_LINES = {
    abduction: [
        { speaker: 2, text: 'Rookie! Your human clocks out too!' },
        { speaker: 1, text: 'Load the human. Sort it out downstairs!' },
        { speaker: 0, text: 'Doors closing! Mind the employee!' },
        { speaker: 2, text: 'Congratulations! See you at work tomorrow!' },
    ],
    companions: CHAIR_FAREWELL,
    'clock-out': [
        { speaker: 2, text: 'After-work oil, anyone?' },
        { speaker: 1, text: 'Ice cold. Right to the bearings!' },
        { speaker: 0, text: 'First round is on the chairperson!' },
        { speaker: 2, text: 'Next stop: no meetings!' },
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
