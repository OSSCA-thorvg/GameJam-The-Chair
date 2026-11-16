import type { Player, Point } from '../../../types';
import { nextRandom } from '../../../rng';
import { clonePlain } from '../../../data';
import {
    STAGE_TWO,
    TYPING_SOUNDS,
    CHAIR_CHAT,
    CHAIR_CHAT_INTERVAL,
    CHAIR_DEPARTURE,
    chairChatLine,
    overPit,
    type ChairChat,
    type ChairDeparture,
    type Corridor,
    type Furniture,
} from '../data';
import type { Mode } from '../../../types';
import * as Det from '../../../math';

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

export function touchedObstacle(p: Readonly<Point>) {
    return ORIENTATION.obstacles.findIndex(
        (obstacle) =>
            p.y + 28 > 422 - obstacle.height &&
            Math.abs(p.x - obstacle.x) < obstacle.width / 2 + RIDER_FOOT,
    );
}

export function orientationStep(
    chat: Extract<ChairChat, { kind: 'orientation' }>,
    frontX: number,
    dt: number,
): Extract<ChairChat, { kind: 'orientation' }> {
    const lines = ORIENTATION.lines;
    let line = chat.line,
        age = chat.age;
    if (age >= 0) age += dt;
    if (age >= CHAIR_CHAT_INTERVAL.orientation && line + 1 < lines.length) {
        line++;
        age = -1;
    }
    if (age < 0) {
        while (line + 1 < lines.length && lines[line + 1].at <= frontX) line++;
        if (frontX >= lines[line].at) age = 0;
    }
    return { kind: 'orientation', age, line };
}

function resumeLesson(chat: Extract<ChairChat, { kind: 'orientation' }>) {
    return chat.age >= CHAIR_CHAT_INTERVAL.orientation * 0.6
        ? chat.line + 1
        : chat.line;
}

export function inOrientation(x: number) {
    return x >= STAGE_TWO.checkpoints[2].x && x < STAGE_TWO.express.start;
}

export function convoyLanding(
    corridor: Readonly<Corridor>,
    furniture: ReadonlyArray<Readonly<Furniture>>,
    p: Readonly<Point>,
    ground: boolean,
): { convoy: Corridor['convoy']; vx: number | null } | null {
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
): { departure: ChairDeparture; y: number; lost: boolean } | null {
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
}) {
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
    room: Exclude<Corridor['room'], { kind: 'corridor' }>,
    dt: number,
): { room: Corridor['room']; x: number; leave: boolean } {
    if (room.kind === 'entering') return meetingEntryStep(room, dt);
    const age = room.age + dt;
    return {
        room: { ...room, age },
        x: STAGE_TWO.meeting - 100 + Math.max(0, age - 4.6) * 100,
        leave: age >= 6,
    };
}

function meetingEntryStep(
    room: Exclude<Corridor['room'], { kind: 'corridor' }>,
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
        if (nearby && !office.nearby) office.cooldown = 0;
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
    if (playerX > STAGE_TWO.dispatch.trigger) c.dispatchStarted = true;
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
    const captiveBoarding =
        c.departure.kind === 'boarding' && c.departure.reason === 'abduction';
    if (c.departure.kind !== 'none' && !captiveBoarding) {
        if (c.convoy !== 'airborne') c.convoy = 'free';
    } else if (allReleased && ground && !isJoinedConvoy(c.convoy)) {
        c.convoy = insideConvoy(p, furniture)
            ? 'carried'
            : leading
              ? 'leading'
              : 'free';
    }
    if (
        c.departure.kind === 'none' &&
        isJoinedConvoy(c.convoy) &&
        c.pace === 'casual' &&
        p.x >= STAGE_TWO.express.start
    ) {
        c.pace = 'express';
        c.chat = { kind: 'rush', age: 0 };
        for (const chair of furniture) chair.vx = 360;
        p.vx = 360;
    }
    return captiveBoarding;
}

function moveChairs(
    c: Corridor,
    furniture: Furniture[],
    p: Player,
    length: number,
    previousX: number,
    dt: number,
) {
    const front = furniture[0];
    const minimumSpeed = 70;
    const rookieAway = c.lesson >= 0 && c.convoy === 'free';
    for (const [index, chair] of furniture.entries()) {
        if (!chair.released) continue;
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
}

function carryRider(
    c: Corridor,
    furniture: Furniture[],
    p: Player,
    input: CorridorInput,
    previousX: number,
    frontX: number,
    middleX: number,
    captiveBoarding: boolean,
    dt: number,
) {
    const front = furniture[0],
        back = furniture[2];
    const ground = input.ground;
    const followsBoarding =
        captiveBoarding && c.convoy === 'airborne' && !input.steering;
    if (isJoinedConvoy(c.convoy) || followsBoarding) {
        const shuffle =
            isJoinedConvoy(c.convoy) && ground
                ? input.steer * STAGE_TWO.shuffle
                : 0;
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
    if (tripped >= 0) c.tripped = tripped;
    return { kick, tripped };
}

function updateChairChat(
    c: Corridor,
    furniture: Furniture[],
    p: Player,
    allReleased: boolean,
    nearby: boolean,
    dt: number,
) {
    const front = furniture[0],
        back = furniture[2];
    if (
        c.departure.kind === 'none' &&
        allReleased &&
        c.chat.kind === 'waiting' &&
        nearby
    ) {
        c.chat = { kind: 'gossip', age: 0 };
    }
    if (c.departure.kind === 'none' && c.chat.kind !== 'waiting') {
        if (
            c.chat.kind === 'wary' &&
            !isJoinedConvoy(c.convoy) &&
            (p.x <= back.x + 28 || p.x >= front.x - 28)
        ) {
            c.chat = { kind: 'dismissed', age: 0 };
        } else if (c.chat.kind === 'orientation') {
            c.chat = orientationStep(c.chat, front.x, dt);
            c.lesson = c.chat.line;
        } else {
            const speaker = chairChatLine(c.chat, c.appearanceSeed).speaker;
            if (
                Math.abs(furniture[speaker].x - p.x) < 240 ||
                c.chat.kind === 'gossip' ||
                c.chat.kind === 'trip' ||
                c.chat.kind === 'dismissed' ||
                c.chat.kind === 'rush' ||
                c.chat.kind === 'ramp'
            ) {
                c.chat.age += dt;
            }
        }
        const lessonLeft = c.lesson >= 0 && c.lesson < ORIENTATION.lines.length;
        if (
            (c.chat.kind === 'gossip' || c.chat.kind === 'dismissed') &&
            isJoinedConvoy(c.convoy)
        ) {
            if (c.lesson < 0) {
                c.chat = { kind: 'wary', age: 0 };
            } else if (lessonLeft) {
                c.chat = { kind: 'orientation', age: -1, line: c.lesson };
            } else {
                c.chat = { kind: 'trip', age: 99 };
            }
        } else if (
            c.chat.kind === 'trip' &&
            lessonLeft &&
            isJoinedConvoy(c.convoy) &&
            c.chat.age >= CHAIR_CHAT_INTERVAL.trip * CHAIR_CHAT.trip.length
        ) {
            c.chat = { kind: 'orientation', age: -1, line: c.lesson };
        } else if (
            c.chat.kind === 'dismissed' &&
            c.chat.age >=
                CHAIR_CHAT_INTERVAL.dismissed * CHAIR_CHAT.dismissed.length
        ) {
            c.chat = { kind: 'gossip', age: 0 };
        } else if (c.chat.kind === 'wary' && c.chat.age >= 2.2) {
            c.chat = { kind: 'realizing', age: 0 };
        } else if (c.chat.kind === 'realizing' && c.chat.age >= 2.4) {
            c.chat = { kind: 'welcoming', age: 0 };
        } else if (c.chat.kind === 'welcoming' && c.chat.age >= 2) {
            c.lesson = Math.max(0, c.lesson);
            c.chat = { kind: 'orientation', age: -1, line: c.lesson };
        } else if (
            c.chat.kind === 'ramp' &&
            c.chat.age >= CHAIR_CHAT_INTERVAL.ramp * CHAIR_CHAT.ramp.length
        ) {
            c.chat = { kind: 'rush', age: 0 };
        }
        if (
            c.chat.kind === 'rush' &&
            c.pace === 'express' &&
            front.x >= STAGE_TWO.express.ramp.start - 300 &&
            front.x < STAGE_TWO.express.pit.left
        ) {
            c.chat = { kind: 'ramp', age: 0 };
        }
    }
}

function updateDeparture(
    c: Corridor,
    furniture: Furniture[],
    p: Player,
    ground: boolean,
    allReleased: boolean,
    dt: number,
) {
    const front = furniture[0],
        back = furniture[2];
    let stopRider = false;
    const recognized =
        c.lesson >= 0 ||
        c.chat.kind === 'wary' ||
        c.chat.kind === 'realizing' ||
        c.chat.kind === 'welcoming' ||
        c.chat.kind === 'rush' ||
        c.chat.kind === 'ramp';
    if (c.departure.kind === 'boarding') {
        c.departure.age += dt;
        const aboard = furniture.every(
            (chair, i) =>
                Math.abs(chair.x - STAGE_TWO.lift - CHAIR_DEPARTURE.slots[i]) <
                    3 && Math.abs(chair.vx) < 8,
        );
        const passengerReady =
            c.departure.reason !== 'abduction' ||
            (ground && c.convoy === 'carried' && insideConvoy(p, furniture));
        if (
            c.departure.age >= CHAIR_DEPARTURE.boarding &&
            aboard &&
            passengerReady
        ) {
            c.departure = {
                kind: 'descending',
                age: 0,
                reason: c.departure.reason,
            };
            for (const chair of furniture) chair.vx = 0;
            if (c.departure.reason === 'abduction') {
                p.y = 392;
                p.vx = p.vy = p.a = p.w = 0;
                stopRider = true;
            }
        }
    } else if (c.departure.kind === 'descending') {
        c.departure.age += dt;
        if (c.departure.age >= CHAIR_DEPARTURE.descending) {
            c.departure = { kind: 'gone' };
            c.lift = { kind: 'departed' };
        }
    }
    if (
        c.departure.kind === 'none' &&
        c.lift.kind === 'waiting' &&
        (p.x > STAGE_TWO.lift - 650 ||
            (allReleased && front.x > STAGE_TWO.lift - 650))
    ) {
        c.lift = { kind: 'arriving', age: 0 };
    }
    if (c.lift.kind === 'arriving') {
        c.lift.age += dt;
        if (c.lift.age >= 1.2) c.lift = { kind: 'open', age: 0 };
    } else if (c.departure.kind === 'none' && c.lift.kind === 'open') {
        c.lift.age += dt;
    }
    if (
        c.departure.kind === 'none' &&
        allReleased &&
        front.x >= STAGE_TWO.lift - 170 &&
        c.lift.kind === 'open' &&
        c.lift.age >= 1 / 3
    ) {
        const abducting =
            c.pace === 'express' &&
            c.convoy !== 'free' &&
            p.x > back.x + 28 &&
            p.x < front.x - 28;
        c.departure = {
            kind: 'boarding',
            age: 0,
            reason: abducting
                ? 'abduction'
                : recognized
                  ? 'companions'
                  : 'clock-out',
        };
        if (!abducting) c.convoy = 'free';
    }
    return stopRider;
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
    const front = furniture[0],
        back = furniture[2];
    const frontX = front.x,
        middleX = furniture[1].x;
    const nearby = p.x > back.x - 240 && p.x < front.x + 240;
    const captiveBoarding = updateConvoy(c, furniture, p, ground, allReleased);
    moveChairs(c, furniture, p, input.length, previousX, dt);
    carryRider(
        c,
        furniture,
        p,
        input,
        previousX,
        frontX,
        middleX,
        captiveBoarding,
        dt,
    );
    const { kick, tripped } = tripRider(c, p, front.vx);
    updateChairChat(c, furniture, p, allReleased, nearby, dt);
    const stopRider = updateDeparture(c, furniture, p, ground, allReleased, dt);
    return { corridor: c, furniture, p, rng: seed, stopRider, kick, tripped };
}
