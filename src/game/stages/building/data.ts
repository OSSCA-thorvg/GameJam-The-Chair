import type { Point } from '../../types';
import type { Message } from '../../../i18n';
import { deepFreeze } from '../../data';

export const TYPING_SOUNDS = deepFreeze(['typing.1', 'typing.2', 'typing.3', 'typing.4', 'typing.5'] satisfies Message[]);
export type { StageId } from '../../types';
export type Furniture = { kind: 'chair'; x: number; y: number; width: number; height: number; vx: number; released: boolean; cheer: number };
// The orientation ride past the second flag: the chairs roll a little faster (`cruise`) and teach the
// rookie to hop. Each obstacle trips a rider that meets it low (`kick`, slowed to `drag`); the convoy then
// slows to `wait` until the rookie is back aboard. The robot vacuum starts at `robot.start` once the
// convoy nears it and drives left at `robot.speed` for `robot.range`, then is gone.
export type ObstacleKind = 'cable' | 'sign' | 'sleeper' | 'robot' | 'strip';
export type Obstacle = { kind: ObstacleKind; x: number; width: number; height: number };
const ORIENTATION = {
    cruise: 220, wait: 120, kick: 200, drag: .4, spin: .4, damage: 5,
    obstacles: [
        { kind: 'cable', x: 4050, width: 40, height: 12 },
        { kind: 'sign', x: 5370, width: 26, height: 34 },
        { kind: 'sleeper', x: 6250, width: 80, height: 18 },
        { kind: 'robot', x: 7650, width: 48, height: 18 },
        { kind: 'strip', x: 8450, width: 30, height: 12 },
        { kind: 'strip', x: 8620, width: 30, height: 12 },
    ] satisfies Obstacle[],
    robot: { start: 7650, trigger: 7170, speed: 60, range: 1200 },
    // Each line waits for the front chair to reach `at`, so every rule is said before its obstacle.
    lines: [
        { at: 3650, speaker: 0, text: 'chair.orientation.1' },
        { at: 4090, speaker: 1, text: 'chair.orientation.2' },
        { at: 4530, speaker: 2, text: 'chair.orientation.3' },
        { at: 4970, speaker: 0, text: 'chair.orientation.4' },
        { at: 5410, speaker: 2, text: 'chair.orientation.5' },
        { at: 5850, speaker: 0, text: 'chair.orientation.6' },
        { at: 6290, speaker: 1, text: 'chair.orientation.7' },
        { at: 6730, speaker: 2, text: 'chair.orientation.8' },
        { at: 7170, speaker: 1, text: 'chair.orientation.9' },
        { at: 7610, speaker: 2, text: 'chair.orientation.10' },
        { at: 8050, speaker: 0, text: 'chair.orientation.11' },
        { at: 8490, speaker: 1, text: 'chair.orientation.12' },
        { at: 8930, speaker: 2, text: 'chair.orientation.13' },
        { at: 9370, speaker: 1, text: 'chair.orientation.14' },
    ] satisfies { at: number; speaker: 0 | 1 | 2; text: Message }[],
};
// The rush-hour corridor after orientation (`start`). Early on one speed bump (`bump`): at express speed it kicks
// a carried rider out of the convoy, up by `kick` with a `spin` and slowed to `drag` of the convoy's speed
// (hop it: jump without pushing on). Then a ramp (`ramp.start` rising `ramp.rise` to
// its lip at `pit.left`) before a construction hole: a well-timed jump from the express convoy
// gets the `launch` impulse and clears the hole; rolling up it on foot falls short.
// The lift stays far enough past the hole that the convoy can still sweep a rookie back aboard.
const EXPRESS = {
    start: 9850,
    bump: 10130, kick: 300, spin: .5, drag: .1,
    ramp: { start: 10580, rise: 40 },
    pit: { left: 10730, right: 11070 },
    launch: 500,
};
export const STAGE_TWO = deepFreeze({
    length: 12500, goal: 12250,
    meeting: 620,
    meetingEntry: .65,
    dispatch: { room: 1840, trigger: 1320 },
    lift: 11700,
    offices: [220, 1030, 1560, 2370],
    checkpoints: [{ x: 100, y: 392 }, { x: 1300, y: 392 }, { x: 2200, y: 392 }, { x: 6950, y: 392 }, { x: 11850, y: 392 }],
    orientation: ORIENTATION,
    express: EXPRESS,
    terrain: [
        [{ x: -400, y: 420 }, { x: EXPRESS.ramp.start, y: 420 }, { x: EXPRESS.pit.left, y: 420 - EXPRESS.ramp.rise },
            { x: EXPRESS.pit.left, y: 800 }, { x: -400, y: 800 }],
        [{ x: EXPRESS.pit.right, y: 420 }, { x: 12950, y: 420 }, { x: 12950, y: 800 }, { x: EXPRESS.pit.right, y: 800 }],
    ] satisfies Point[][],
});
// The robot vacuum's position once it has driven off.
export const ROBOT_GONE = -9999;
// Where each orientation obstacle stands now; the robot vacuum moves.
export function obstacleX(obstacle: Readonly<Obstacle>, robotX: number) {
    return obstacle.kind === 'robot' ? robotX : obstacle.x;
}
export function overPit(x: number) {
    return x > STAGE_TWO.express.pit.left && x < STAGE_TWO.express.pit.right;
}
export type ChairChat = { kind: 'waiting' }
    | { kind: 'gossip' | 'wary' | 'dismissed' | 'realizing' | 'welcoming' | 'trip' | 'rush' | 'ramp'; age: number }
    | { kind: 'orientation'; age: number; line: number };
export const CHAIR_CHAT = deepFreeze({
    rush: [
        { speaker: 0, text: 'chair.rush.1' },
        { speaker: 1, text: 'chair.rush.2' },
        { speaker: 2, text: 'chair.rush.3' },
    ],
    // Shouted back at the rookie as the front chair nears the launch ramp.
    ramp: [
        { speaker: 0, text: 'chair.ramp.1' },
        { speaker: 1, text: 'chair.ramp.2' },
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
    // The convoy waits after the rookie trips.
    trip: [
        { speaker: 2, text: 'chair.trip.1' },
        { speaker: 0, text: 'chair.trip.2' },
    ],
} satisfies Record<Exclude<ChairChat['kind'], 'waiting' | 'orientation'>, { speaker: 0 | 1 | 2; text: Message }[]>);
export const CHAIR_CHAT_INTERVAL = deepFreeze({ gossip: 3.2, wary: 4, dismissed: 1.9, realizing: 4, welcoming: 4, orientation: 2, trip: 1.5, rush: 1.6, ramp: 1 });
export function chairChatLine(chat: Exclude<ChairChat, { kind: 'waiting' }>, seed: number) {
    if (chat.kind === 'orientation') return ORIENTATION.lines[chat.line];
    const lines = CHAIR_CHAT[chat.kind];
    const topic = chat.kind === 'gossip' ? seed % (lines.length / 3) : 0;
    return lines[(topic * 3 + Math.floor(chat.age / CHAIR_CHAT_INTERVAL[chat.kind])) % lines.length];
}
// Orientation and trip lines are said once; the others loop.
export function chairChatOnce(kind: ChairChat['kind']) {
    return kind === 'orientation' || kind === 'trip';
}
export type ChairDepartureReason = 'companions' | 'clock-out' | 'abduction';
export type ChairDeparture = { kind: 'none' } | { kind: 'boarding' | 'descending'; age: number; reason: ChairDepartureReason } | { kind: 'gone' | 'lost' };
export const CHAIR_DEPARTURE = deepFreeze({ boarding: 5, descending: 2, slots: [58, 0, -58] });
export const CHAIR_FAREWELL = deepFreeze([
    { speaker: 2, text: 'chair.farewell.1' },
    { speaker: 1, text: 'chair.farewell.2' },
    { speaker: 0, text: 'chair.farewell.3' },
    { speaker: 2, text: 'chair.farewell.4' },
] satisfies { speaker: 0 | 1 | 2; text: Message }[]);
export const CHAIR_DEPARTURE_LINES = deepFreeze({
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
} satisfies Record<ChairDepartureReason, readonly { readonly speaker: 0 | 1 | 2; readonly text: Message }[]>);
export type Corridor = {
    appearanceSeed: number;
    room: { kind: 'corridor' } | { kind: 'entering' | 'meeting'; age: number; returnX: number };
    meetingVisited: boolean;
    dispatchAge: number;
    dispatchStarted: boolean;
    chat: ChairChat;
    // The next orientation line to say when the rookie (re)joins; -1 before the welcome.
    lesson: number;
    robot: number;
    // The orientation obstacle the rider is tripping on, so one obstacle trips it once.
    tripped: number;
    // 'leading': rolling at the head; 'leading-airborne': jumping from there; 'dropped': hit by the bump.
    convoy: 'free' | 'carried' | 'leading' | 'airborne' | 'leading-airborne' | 'dropped';
    pace: 'casual' | 'express';
    departure: ChairDeparture;
    lift: { kind: 'waiting' } | { kind: 'arriving'; age: number } | { kind: 'open'; age: number } | { kind: 'departed' };
    typingCooldown: number;
    offices: { x: number; life: number; cooldown: number; nearby: boolean; phrase: number; offset: Point }[];
};
export function createCorridor(checkpoint: number, appearanceSeed: number): Corridor {
    return {
        appearanceSeed,
        room: { kind: 'corridor' }, meetingVisited: false,
        dispatchStarted: checkpoint >= 2, dispatchAge: checkpoint >= 2 ? 10 : 0,
        chat: { kind: 'waiting' },
        lesson: checkpoint >= 3 ? ORIENTATION.lines.findIndex(line => line.at >= STAGE_TWO.checkpoints[3].x) : -1,
        robot: ORIENTATION.robot.start,
        tripped: -1,
        convoy: 'free',
        pace: 'casual',
        departure: { kind: checkpoint >= 4 ? 'gone' : 'none' },
        lift: { kind: checkpoint >= 4 ? 'departed' : 'waiting' },
        typingCooldown: 0,
        offices: STAGE_TWO.offices.map(x => ({ x, life: 0, cooldown: 0, nearby: false, phrase: 0, offset: { x: 0, y: 0 } })),
    };
}
export function createFurniture(checkpoint = 0): Furniture[] {
    const front = checkpoint >= 2 ? STAGE_TWO.checkpoints[checkpoint].x + 190 : STAGE_TWO.dispatch.room + 12;
    return [0, 1, 2].map(i => {
        const x = checkpoint >= 2 ? front - i * 130 : front;
        return { kind: 'chair', x, y: 420, width: 48, height: 40, vx: checkpoint >= 2 ? STAGE_TWO.orientation.cruise : 0, released: checkpoint >= 2, cheer: 0 };
    });
}
