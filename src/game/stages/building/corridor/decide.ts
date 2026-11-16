import { clonePlain } from '../../../data';
import * as Det from '../../../math';
import { nextRandom } from '../../../rng';
import {
    STAGE_TWO,
    TYPING_SOUNDS,
    CHAIR_CHAT,
    CHAIR_CHAT_INTERVAL,
    CHAIR_DEPARTURE,
    chairChatLine,
    overPit,
} from '../data';

import type { Player, Point, Mode } from '../../../types';
import type { ChairChat, ChairDeparture, Corridor, Furniture } from '../data';
function insideConvoy(
    p: Readonly<Point>,
    furniture: ReadonlyArray<Readonly<Furniture>>,
) {
    return p.y > 360 && p.x > furniture[2].x + 28 && p.x < furniture[0].x - 28;
}
function leadsConvoy(
    p: Readonly<Point>,
    furniture: ReadonlyArray<Readonly<Furniture>>,
) {
    const front = furniture[0];
    return p.y > 360 && p.x >= front.x - 28 && p.x < front.x + 240;
}
function isJoinedConvoy(
    convoy: Corridor['convoy'],
): convoy is 'carried' | 'leading' {
    return convoy === 'carried' || convoy === 'leading';
}
const ORIENTATION = STAGE_TWO.orientation;
const RIDER_FOOT = 12;
export function touchedObstacle(p: Readonly<Point>): number {
    return ORIENTATION.obstacles.findIndex(
        (obstacle) =>
            p.y + 28 > 422 - obstacle.height &&
            Math.abs(p.x - obstacle.x) < obstacle.width / 2 + RIDER_FOOT,
    );
}
export function orientationStep(
    chat: Extract<
        ChairChat,
        {
            kind: 'orientation';
        }
    >,
    frontX: number,
    dt: number,
): Extract<
    ChairChat,
    {
        kind: 'orientation';
    }
> {
    const lines = ORIENTATION.lines;
    let line = chat.line;
    let age = chat.age;
    if (age >= 0) {
        age += dt;
    }
    if (age >= CHAIR_CHAT_INTERVAL.orientation && line + 1 < lines.length) {
        line++;
        age = -1;
    }
    if (age < 0) {
        while (line + 1 < lines.length && lines[line + 1].at <= frontX) {
            line++;
        }
        if (frontX >= lines[line].at) {
            age = 0;
        }
    }
    return { kind: 'orientation', age, line };
}
function resumeLesson(
    chat: Extract<
        ChairChat,
        {
            kind: 'orientation';
        }
    >,
) {
    return chat.age >= CHAIR_CHAT_INTERVAL.orientation * 0.6
        ? chat.line + 1
        : chat.line;
}
export function inOrientation(x: number): boolean {
    return x >= STAGE_TWO.checkpoints[2].x && x < STAGE_TWO.express.start;
}
export function convoyLanding(
    corridor: Readonly<Corridor>,
    furniture: ReadonlyArray<Readonly<Furniture>>,
    p: Readonly<Point>,
    ground: boolean,
): {
    convoy: Corridor['convoy'];
    vx: number | null;
} | null {
    if (
        (corridor.convoy !== 'airborne' &&
            corridor.convoy !== 'leading-airborne') ||
        !ground
    ) {
        return null;
    }
    const departure = corridor.departure;
    const canCarry =
        departure.kind === 'none' ||
        (departure.kind === 'boarding' && departure.reason === 'abduction');
    const convoy = !canCarry
        ? 'free'
        : insideConvoy(p, furniture)
          ? 'carried'
          : corridor.convoy === 'leading-airborne' && leadsConvoy(p, furniture)
            ? 'leading'
            : 'free';
    return { convoy, vx: isJoinedConvoy(convoy) ? furniture[0].vx : null };
}
export function liftRide(
    departure: Readonly<ChairDeparture>,
    dt: number,
): {
    departure: ChairDeparture;
    y: number;
    lost: boolean;
} | null {
    if (departure.kind !== 'descending' || departure.reason !== 'abduction') {
        return null;
    }
    const age = departure.age + dt;
    const lost = age >= CHAIR_DEPARTURE.descending;
    return {
        departure: lost ? { kind: 'lost' } : { ...departure, age },
        y: 392 + Math.min(1, age / CHAIR_DEPARTURE.descending) * 165,
        lost,
    };
}
export function canEnterMeeting(s: {
    stage: number;
    mode: Mode;
    corridor: Readonly<Corridor>;
    p: Readonly<Point>;
    ground: boolean;
}): boolean {
    return (
        s.stage === 2 &&
        s.mode === 'play' &&
        s.corridor.room.kind === 'corridor' &&
        s.corridor.convoy === 'free' &&
        Math.abs(s.p.x - STAGE_TWO.meeting) < 125 &&
        s.ground
    );
}
export const MEETING_SEAT: Readonly<Player> = Object.freeze({
    x: STAGE_TWO.meeting - 100,
    y: 392,
    vx: 0,
    vy: 0,
    a: 0,
    w: 0,
});
export function meetingExit(returnX: number, pushed: boolean): Player {
    return {
        x: returnX + (pushed ? 110 : 0),
        y: 392,
        vx: pushed ? 180 : 0,
        vy: 0,
        a: 0,
        w: 0,
    };
}
export function meetingStep(
    room: Exclude<
        Corridor['room'],
        {
            kind: 'corridor';
        }
    >,
    dt: number,
): {
    room: Corridor['room'];
    x: number;
    leave: boolean;
} {
    if (room.kind === 'entering') {
        return meetingEntryStep(room, dt);
    }
    const age = room.age + dt;
    return {
        room: { ...room, age },
        x: STAGE_TWO.meeting - 100 + Math.max(0, age - 4.6) * 100,
        leave: age >= 6,
    };
}
function meetingEntryStep(
    room: Exclude<
        Corridor['room'],
        {
            kind: 'corridor';
        }
    >,
    dt: number,
) {
    const age = room.age + dt;
    if (age >= STAGE_TWO.meetingEntry) {
        return {
            room: {
                ...room,
                kind: 'meeting',
                age: age - STAGE_TWO.meetingEntry,
            } satisfies Corridor['room'],
            x: MEETING_SEAT.x,
            leave: false,
        };
    }
    const progress = Math.max(0, (age / STAGE_TWO.meetingEntry - 0.2) / 0.8);
    const glide = progress * progress * (3 - 2 * progress);
    return {
        room: { ...room, age },
        x: room.returnX + (STAGE_TWO.meeting - room.returnX) * glide,
        leave: false,
    };
}
export type CorridorInput = {
    corridor: Readonly<Corridor>;
    furniture: ReadonlyArray<Readonly<Furniture>>;
    p: Readonly<Player>;
    ground: boolean;
    steering: boolean;
    steer: number;
    rng: number;
    length: number;
};
export type CorridorResult = {
    corridor: Corridor;
    furniture: Furniture[];
    p: Player;
    rng: number;
    stopRider: boolean;
    kick: 'trip' | null;
    tripped: number;
};
function updateTyping(
    c: Corridor,
    playerX: number,
    dt: number,
    random: () => number,
) {
    c.typingCooldown = Math.max(0, c.typingCooldown - dt);
    for (const office of c.offices) {
        office.life = Math.max(0, office.life - dt);
        office.cooldown = Math.max(0, office.cooldown - dt);
        const nearby = Math.abs(playerX - office.x) < 190;
        if (nearby && !office.nearby) {
            office.cooldown = 0;
        }
        office.nearby = nearby;
    }
    if (
        c.typingCooldown === 0 &&
        !c.offices.some((office) => office.life > 0)
    ) {
        const office = c.offices.find(
            (office) => office.nearby && office.cooldown === 0,
        );
        if (office) {
            office.phrase =
                (office.phrase +
                    1 +
                    Math.floor(random() * (TYPING_SOUNDS.length - 1))) %
                TYPING_SOUNDS.length;
            const offsetX = (random() - 0.5) * 140;
            office.offset = { x: offsetX, y: 22 + random() * 132 };
            office.life = 1.5;
            office.cooldown = 4.5;
            c.typingCooldown = office.life + 0.3;
        }
    }
}
function dispatchChairs(
    c: Corridor,
    furniture: Furniture[],
    playerX: number,
    dt: number,
) {
    if (playerX > STAGE_TWO.dispatch.trigger) {
        c.dispatchStarted = true;
    }
    if (c.dispatchStarted) {
        c.dispatchAge += dt;
        furniture.forEach((chair, i) => {
            if (!chair.released && c.dispatchAge >= 0.7 + i * 0.9) {
                chair.released = true;
                chair.vx = 170 + i * 15;
                chair.cheer = 2.4;
            }
        });
    }
}
function updateConvoy(
    c: Corridor,
    furniture: Furniture[],
    p: Player,
    ground: boolean,
    allReleased: boolean,
) {
    const leading =
        allReleased &&
        ground &&
        c.pace === 'casual' &&
        leadsConvoy(p, furniture) &&
        p.x >= STAGE_TWO.checkpoints[2].x;
    updateConvoyMembership(c, allReleased, ground, p, {
        furniture,
        leading,
    });
    if (
        c.departure.kind === 'none' &&
        isJoinedConvoy(c.convoy) &&
        c.pace === 'casual' &&
        p.x >= STAGE_TWO.express.start
    ) {
        c.pace = 'express';
        c.chat = { kind: 'rush', age: 0 };
        for (const chair of furniture) {
            chair.vx = 360;
        }
        p.vx = 360;
    }
}
function updateConvoyMembership(
    c: Corridor,
    allReleased: boolean,
    ground: boolean,
    p: Player,
    {
        furniture,
        leading,
    }: {
        furniture: Furniture[];
        leading: boolean;
    },
) {
    const captiveBoarding =
        c.departure.kind === 'boarding' && c.departure.reason === 'abduction';
    if (c.departure.kind !== 'none' && !captiveBoarding) {
        if (c.convoy !== 'airborne') {
            c.convoy = 'free';
        }
    } else if (allReleased && ground && !isJoinedConvoy(c.convoy)) {
        c.convoy = insideConvoy(p, furniture)
            ? 'carried'
            : leading
              ? 'leading'
              : 'free';
    }
}
function moveChairs(
    c: Corridor,
    furniture: Furniture[],
    p: Player,
    {
        length,
        previousX,
        dt,
    }: {
        length: number;
        previousX: number;
        dt: number;
    },
) {
    const front = furniture[0];
    const minimumSpeed = 70;
    const rookieAway = c.lesson >= 0 && c.convoy === 'free';
    for (const [index, chair] of furniture.entries()) {
        if (!chair.released) {
            continue;
        }
        chair.cheer = Math.max(0, chair.cheer - dt);
        if (
            c.departure.kind === 'gone' ||
            c.departure.kind === 'lost' ||
            c.departure.kind === 'descending'
        ) {
            continue;
        }
        if (c.departure.kind === 'boarding') {
            const target = STAGE_TWO.lift + CHAIR_DEPARTURE.slots[index];
            const speed = Math.max(-300, Math.min(300, (target - chair.x) * 4));
            chair.vx += (speed - chair.vx) * (1 - Det.exp(-8 * dt));
            chair.x += chair.vx * dt;
            chair.y = 420;
            continue;
        }
        advanceReleasedChair(front, index, c, rookieAway, {
            minimumSpeed,
            chair,
            dt,
            length,
            p,
            previousX,
            furniture,
        });
    }
}
type ConvoyMovement = Pick<
    CorridorInput,
    'ground' | 'steering' | 'steer' | 'length'
> & { previousX: number; dt: number };
function advanceReleasedChair(
    front: Furniture,
    index: number,
    c: Corridor,
    rookieAway: boolean,
    {
        minimumSpeed,
        chair,
        dt,
        length,
        p,
        previousX,
        furniture,
    }: {
        minimumSpeed: number;
        chair: Furniture;
        dt: number;
        length: number;
        p: Player;
        previousX: number;
        furniture: Furniture[];
    },
) {
    const target = front.x - index * 130;
    const cruise =
        c.pace === 'express'
            ? 360
            : !inOrientation(front.x)
              ? 185
              : rookieAway
                ? ORIENTATION.wait
                : ORIENTATION.cruise;
    const speed =
        index === 0
            ? cruise
            : Math.max(
                  minimumSpeed,
                  Math.min(cruise + 170, cruise + (target - chair.x) * 2),
              );
    chair.vx += (speed - chair.vx) * (1 - Det.exp(-4 * dt));
    chair.x = Math.min(length + 450 + index * 130, chair.x + chair.vx * dt);
    if (c.convoy === 'free' && p.y > 350 && Math.abs(p.x - chair.x) < 58) {
        const side = previousX < chair.x ? 1 : -1;
        chair.x +=
            side * (58 - Math.abs(p.x - chair.x)) * (1 - Det.exp(-14 * dt));
    }
    if (index > 0 && furniture[index - 1].released) {
        chair.x = Math.min(chair.x, furniture[index - 1].x - 80);
    }
    chair.y = 420;
}
function moveConvoy(
    c: Corridor,
    furniture: Furniture[],
    p: Player,
    { ground, steering, steer, length, previousX, dt }: ConvoyMovement,
) {
    const front = furniture[0];
    const back = furniture[2];
    const frontX = front.x;
    const middleX = furniture[1].x;
    moveChairs(c, furniture, p, { length, previousX, dt });
    const captiveBoarding =
        c.departure.kind === 'boarding' && c.departure.reason === 'abduction';
    const followsBoarding =
        captiveBoarding && c.convoy === 'airborne' && !steering;
    carryConvoyPlayer(c, followsBoarding, ground, steer, {
        previousX,
        front,
        frontX,
        dt,
        middleX,
        back,
        furniture,
        p,
    });
    if (
        isJoinedConvoy(c.convoy) &&
        c.pace === 'express' &&
        (overPit(p.x) ||
            (previousX < STAGE_TWO.express.pit.left &&
                p.x >= STAGE_TWO.express.pit.left))
    ) {
        c.convoy = 'free';
    }
}
function carryConvoyPlayer(
    c: Corridor,
    followsBoarding: boolean,
    ground: boolean,
    steer: number,
    {
        previousX,
        front,
        frontX,
        dt,
        middleX,
        back,
        furniture,
        p,
    }: {
        previousX: number;
        front: Furniture;
        frontX: number;
        dt: number;
        middleX: number;
        back: Furniture;
        furniture: Furniture[];
        p: Player;
    },
) {
    if (isJoinedConvoy(c.convoy) || followsBoarding) {
        const shuffle =
            isJoinedConvoy(c.convoy) && ground ? steer * STAGE_TWO.shuffle : 0;
        const nextX = previousX + front.x - frontX + shuffle * dt;
        const behindMiddle = previousX < middleX;
        let low: number;
        let high: number;
        if (c.convoy === 'leading') {
            low = front.x + 29;
            high = front.x + 239;
        } else if (behindMiddle) {
            low = back.x + 29;
            high = furniture[1].x - 29;
        } else {
            low = furniture[1].x + 29;
            high = front.x - 29;
        }
        p.x = Math.max(low, Math.min(high, nextX));
        p.vx = front.vx + (p.x === nextX ? shuffle : 0);
        if (
            shuffle &&
            c.convoy === 'leading' &&
            nextX > high &&
            c.pace === 'casual'
        ) {
            c.convoy = 'free';
            p.x = nextX;
        }
    }
}
function tripRider(c: Corridor, p: Player, frontSpeed: number) {
    let kick: CorridorResult['kick'] = null;
    let tripped = -1;
    const touched = touchedObstacle(p);
    if (touched >= 0 && touched !== c.tripped) {
        const joined =
            isJoinedConvoy(c.convoy) ||
            c.convoy === 'airborne' ||
            c.convoy === 'leading-airborne';
        kick = 'trip';
        tripped = touched;
        p.vy = -ORIENTATION.kick;
        p.y -= 4;
        p.vx = (joined ? frontSpeed : p.vx) * ORIENTATION.drag;
        p.w += ORIENTATION.spin;
        c.convoy = 'free';
        if (c.chat.kind === 'orientation') {
            c.lesson = resumeLesson(c.chat);
            c.chat = { kind: 'trip', age: 0 };
        }
    }
    if (c.tripped >= 0) {
        const obstacle = ORIENTATION.obstacles[c.tripped];
        if (Math.abs(p.x - obstacle.x) >= obstacle.width / 2 + RIDER_FOOT) {
            c.tripped = -1;
        }
    }
    if (tripped >= 0) {
        c.tripped = tripped;
    }
    return { kick, tripped };
}
function updateChairChat(
    c: Corridor,
    furniture: Furniture[],
    p: Player,
    {
        allReleased,
        nearby,
        dt,
    }: {
        allReleased: boolean;
        nearby: boolean;
        dt: number;
    },
) {
    return new ChairChatTick(c, furniture, p, allReleased, {
        nearby,
        dt,
    }).run();
}
function updateDeparture(
    c: Corridor,
    furniture: Furniture[],
    p: Player,
    {
        ground,
        allReleased,
        dt,
    }: {
        ground: boolean;
        allReleased: boolean;
        dt: number;
    },
) {
    return new ChairDepartureTick(c, furniture, p, ground, {
        allReleased,
        dt,
    }).run();
}
export function corridorStep(
    input: CorridorInput,
    dt: number,
    previousX: number,
): CorridorResult {
    const c = clonePlain(input.corridor) as Corridor;
    const furniture: Furniture[] = input.furniture.map((chair) => ({
        ...chair,
    }));
    const p = { ...input.p };
    const ground = input.ground;
    let seed = input.rng;
    const random = () => {
        const draw = nextRandom(seed);
        seed = draw.state;
        return draw.value;
    };
    updateTyping(c, p.x, dt, random);
    dispatchChairs(c, furniture, p.x, dt);
    const allReleased = furniture.every((chair) => chair.released);
    const front = furniture[0];
    const back = furniture[2];
    const nearby = p.x > back.x - 240 && p.x < front.x + 240;
    updateConvoy(c, furniture, p, ground, allReleased);
    moveConvoy(c, furniture, p, {
        ground,
        steering: input.steering,
        steer: input.steer,
        previousX,
        length: input.length,
        dt,
    });
    const { kick, tripped } = tripRider(c, p, front.vx);
    updateChairChat(c, furniture, p, { allReleased, nearby, dt });
    const stopRider = updateDeparture(c, furniture, p, {
        ground,
        allReleased,
        dt,
    });
    return { corridor: c, furniture, p, rng: seed, stopRider, kick, tripped };
}
class ChairChatTick {
    private c!: Corridor;
    private furniture!: Furniture[];
    private p!: Player;
    private allReleased!: boolean;
    private nearby!: boolean;
    private dt!: number;
    private front!: Furniture;
    private back!: Furniture;
    constructor(
        c: Corridor,
        furniture: Furniture[],
        p: Player,
        allReleased: boolean,
        {
            nearby,
            dt,
        }: {
            nearby: boolean;
            dt: number;
        },
    ) {
        this.c = c;
        this.furniture = furniture;
        this.p = p;
        this.allReleased = allReleased;
        this.nearby = nearby;
        this.dt = dt;
    }
    run() {
        this.front = this.furniture[0];
        this.back = this.furniture[2];
        if (
            this.c.departure.kind === 'none' &&
            this.allReleased &&
            this.c.chat.kind === 'waiting' &&
            this.nearby
        ) {
            this.c.chat = { kind: 'gossip', age: 0 };
        }
        if (
            this.c.departure.kind === 'none' &&
            this.c.chat.kind !== 'waiting'
        ) {
            const lessonLeft = this.advanceChatClock();
            if (!this.enterOrientation(lessonLeft)) {
                this.advanceChatState();
            }
            if (
                this.c.chat.kind === 'rush' &&
                this.c.pace === 'express' &&
                this.front.x >= STAGE_TWO.express.ramp.start - 300 &&
                this.front.x < STAGE_TWO.express.pit.left
            ) {
                this.c.chat = { kind: 'ramp', age: 0 };
            }
        }
    }
    private advanceChatClock() {
        if (this.c.chat.kind === 'waiting') {
            return false;
        }
        if (
            this.c.chat.kind === 'wary' &&
            !isJoinedConvoy(this.c.convoy) &&
            (this.p.x <= this.back.x + 28 || this.p.x >= this.front.x - 28)
        ) {
            this.c.chat = { kind: 'dismissed', age: 0 };
        } else if (this.c.chat.kind === 'orientation') {
            this.c.chat = orientationStep(this.c.chat, this.front.x, this.dt);
            this.c.lesson = this.c.chat.line;
        } else {
            const speaker = chairChatLine(
                this.c.chat,
                this.c.appearanceSeed,
            ).speaker;
            if (
                Math.abs(this.furniture[speaker].x - this.p.x) < 240 ||
                this.c.chat.kind === 'gossip' ||
                this.c.chat.kind === 'trip' ||
                this.c.chat.kind === 'dismissed' ||
                this.c.chat.kind === 'rush' ||
                this.c.chat.kind === 'ramp'
            ) {
                this.c.chat.age += this.dt;
            }
        }
        const lessonLeft =
            this.c.lesson >= 0 && this.c.lesson < ORIENTATION.lines.length;
        return lessonLeft;
    }
    private enterOrientation(lessonLeft: boolean) {
        if (
            (this.c.chat.kind === 'gossip' ||
                this.c.chat.kind === 'dismissed') &&
            isJoinedConvoy(this.c.convoy)
        ) {
            if (this.c.lesson < 0) {
                this.c.chat = { kind: 'wary', age: 0 };
            } else if (lessonLeft) {
                this.c.chat = {
                    kind: 'orientation',
                    age: -1,
                    line: this.c.lesson,
                };
            } else {
                this.c.chat = { kind: 'trip', age: 99 };
            }
            return true;
        }
        if (
            this.c.chat.kind === 'trip' &&
            lessonLeft &&
            isJoinedConvoy(this.c.convoy) &&
            this.c.chat.age >= CHAIR_CHAT_INTERVAL.trip * CHAIR_CHAT.trip.length
        ) {
            this.c.chat = {
                kind: 'orientation',
                age: -1,
                line: this.c.lesson,
            };
            return true;
        }
        return false;
    }
    private advanceChatState() {
        if (
            this.c.chat.kind === 'dismissed' &&
            this.c.chat.age >=
                CHAIR_CHAT_INTERVAL.dismissed * CHAIR_CHAT.dismissed.length
        ) {
            this.c.chat = { kind: 'gossip', age: 0 };
        } else if (this.c.chat.kind === 'wary' && this.c.chat.age >= 2.2) {
            this.c.chat = { kind: 'realizing', age: 0 };
        } else if (this.c.chat.kind === 'realizing' && this.c.chat.age >= 2.4) {
            this.c.chat = { kind: 'welcoming', age: 0 };
        } else if (this.c.chat.kind === 'welcoming' && this.c.chat.age >= 2) {
            this.c.lesson = Math.max(0, this.c.lesson);
            this.c.chat = {
                kind: 'orientation',
                age: -1,
                line: this.c.lesson,
            };
        } else if (
            this.c.chat.kind === 'ramp' &&
            this.c.chat.age >= CHAIR_CHAT_INTERVAL.ramp * CHAIR_CHAT.ramp.length
        ) {
            this.c.chat = { kind: 'rush', age: 0 };
        }
    }
}
class ChairDepartureTick {
    private c!: Corridor;
    private furniture!: Furniture[];
    private p!: Player;
    private ground!: boolean;
    private allReleased!: boolean;
    private dt!: number;
    private front!: Furniture;
    private back!: Furniture;
    private stopRider!: boolean;
    private recognized!: boolean;
    constructor(
        c: Corridor,
        furniture: Furniture[],
        p: Player,
        ground: boolean,
        {
            allReleased,
            dt,
        }: {
            allReleased: boolean;
            dt: number;
        },
    ) {
        this.c = c;
        this.furniture = furniture;
        this.p = p;
        this.ground = ground;
        this.allReleased = allReleased;
        this.dt = dt;
    }
    run() {
        this.front = this.furniture[0];
        this.back = this.furniture[2];
        this.stopRider = false;
        this.recognized = this.recognizesRider();
        this.advanceDepartureMotion();
        this.updateLift();
        return this.startDeparture();
    }
    private startDeparture() {
        if (
            this.c.departure.kind === 'none' &&
            this.allReleased &&
            this.front.x >= STAGE_TWO.lift - 170 &&
            this.c.lift.kind === 'open' &&
            this.c.lift.age >= 1 / 3
        ) {
            const abducting =
                this.c.pace === 'express' &&
                this.c.convoy !== 'free' &&
                this.p.x > this.back.x + 28 &&
                this.p.x < this.front.x - 28;
            this.c.departure = {
                kind: 'boarding',
                age: 0,
                reason: abducting
                    ? 'abduction'
                    : this.recognized
                      ? 'companions'
                      : 'clock-out',
            };
            if (!abducting) {
                this.c.convoy = 'free';
            }
        }
        return this.stopRider;
    }
    private advanceDepartureMotion() {
        if (this.c.departure.kind === 'boarding') {
            this.c.departure.age += this.dt;
            const aboard = this.furniture.every(
                (chair, i) =>
                    Math.abs(
                        chair.x - STAGE_TWO.lift - CHAIR_DEPARTURE.slots[i],
                    ) < 3 && Math.abs(chair.vx) < 8,
            );
            const passengerReady =
                this.c.departure.reason !== 'abduction' ||
                (this.ground &&
                    this.c.convoy === 'carried' &&
                    insideConvoy(this.p, this.furniture));
            if (
                this.c.departure.age >= CHAIR_DEPARTURE.boarding &&
                aboard &&
                passengerReady
            ) {
                this.c.departure = {
                    kind: 'descending',
                    age: 0,
                    reason: this.c.departure.reason,
                };
                for (const chair of this.furniture) {
                    chair.vx = 0;
                }
                if (this.c.departure.reason === 'abduction') {
                    this.p.y = 392;
                    this.p.vx = this.p.vy = this.p.a = this.p.w = 0;
                    this.stopRider = true;
                }
            }
        } else if (this.c.departure.kind === 'descending') {
            this.c.departure.age += this.dt;
            if (this.c.departure.age >= CHAIR_DEPARTURE.descending) {
                this.c.departure = { kind: 'gone' };
                this.c.lift = { kind: 'departed' };
            }
        }
    }
    private recognizesRider() {
        return (
            this.c.lesson >= 0 ||
            this.c.chat.kind === 'wary' ||
            this.c.chat.kind === 'realizing' ||
            this.c.chat.kind === 'welcoming' ||
            this.c.chat.kind === 'rush' ||
            this.c.chat.kind === 'ramp'
        );
    }
    private updateLift() {
        if (
            this.c.departure.kind === 'none' &&
            this.c.lift.kind === 'waiting' &&
            (this.p.x > STAGE_TWO.lift - 650 ||
                (this.allReleased && this.front.x > STAGE_TWO.lift - 650))
        ) {
            this.c.lift = { kind: 'arriving', age: 0 };
        }
        if (this.c.lift.kind === 'arriving') {
            this.c.lift.age += this.dt;
            if (this.c.lift.age >= 1.2) {
                this.c.lift = { kind: 'open', age: 0 };
            }
        } else if (
            this.c.departure.kind === 'none' &&
            this.c.lift.kind === 'open'
        ) {
            this.c.lift.age += this.dt;
        }
    }
}
