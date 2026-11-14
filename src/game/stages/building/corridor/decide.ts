import type { Player, Point } from '../../../types';
import { nextRandom } from '../../../rng';
import { clonePlain } from '../../../data';
import { STAGE_TWO, TYPING_SOUNDS, CHAIR_CHAT, CHAIR_CHAT_INTERVAL, CHAIR_DEPARTURE, chairChatLine, obstacleX, overPit, ROBOT_GONE, type ChairChat, type ChairDeparture, type Corridor, type Furniture } from '../data';
import type { Mode } from '../../../types';
import * as Det from '../../../math';

function insideConvoy(p: Readonly<Point>, furniture: readonly Readonly<Furniture>[]) {
    return p.y > 360 && p.x > furniture[2].x + 28 && p.x < furniture[0].x - 28;
}

function leadsConvoy(p: Readonly<Point>, furniture: readonly Readonly<Furniture>[]) {
    const front = furniture[0];
    return p.y > 360 && p.x >= front.x - 28 && p.x < front.x + 240;
}

function isJoinedConvoy(convoy: Corridor['convoy']): convoy is 'carried' | 'leading' {
    return convoy === 'carried' || convoy === 'leading';
}

const ORIENTATION = STAGE_TWO.orientation;
const RIDER_FOOT = 12;

// The orientation obstacle a rider low enough to meet it is touching, or -1.
export function touchedObstacle(p: Readonly<Point>, robotX: number) {
    return ORIENTATION.obstacles.findIndex(obstacle => p.y + 28 > 422 - obstacle.height
        && Math.abs(p.x - obstacleX(obstacle, robotX)) < obstacle.width / 2 + RIDER_FOOT);
}

// One orientation line at a time: each waits (negative age) until the front chair reaches its `at`,
// and a line whose moment has passed is skipped so the rules stay ahead of their obstacles.
export function orientationStep(chat: Extract<ChairChat, { kind: 'orientation' }>, frontX: number, dt: number): Extract<ChairChat, { kind: 'orientation' }> {
    const lines = ORIENTATION.lines;
    let line = chat.line, age = chat.age;
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

// The line to resume with when the rookie rejoins: the interrupted one, or the next if it was said.
function resumeLesson(chat: Extract<ChairChat, { kind: 'orientation' }>) {
    return chat.age >= CHAIR_CHAT_INTERVAL.orientation * .6 ? chat.line + 1 : chat.line;
}

export function inOrientation(x: number) {
    return x >= STAGE_TWO.checkpoints[2].x && x < STAGE_TWO.express.start;
}

// Landing from a jump onto the moving chairs rides along; landing anywhere else frees the rider.
export function convoyLanding(corridor: Readonly<Corridor>, furniture: readonly Readonly<Furniture>[], p: Readonly<Point>, ground: boolean): { convoy: Corridor['convoy']; vx: number | null } | null {
    if ((corridor.convoy !== 'airborne' && corridor.convoy !== 'leading-airborne') || !ground) return null;
    const departure = corridor.departure;
    const canCarry = departure.kind === 'none' || (departure.kind === 'boarding' && departure.reason === 'abduction');
    const convoy = !canCarry ? 'free'
        : insideConvoy(p, furniture) ? 'carried'
            : corridor.convoy === 'leading-airborne' && leadsConvoy(p, furniture) ? 'leading' : 'free';
    return { convoy, vx: isJoinedConvoy(convoy) ? furniture[0].vx : null };
}

// A rider carried into the lift goes down with the chairs. `lost` once the doors close below.
export function liftRide(departure: Readonly<ChairDeparture>, dt: number): { departure: ChairDeparture; y: number; lost: boolean } | null {
    if (departure.kind !== 'descending' || departure.reason !== 'abduction') return null;
    const age = departure.age + dt;
    const lost = age >= CHAIR_DEPARTURE.descending;
    return {
        departure: lost ? { kind: 'lost' } : { ...departure, age },
        y: 392 + Math.min(1, age / CHAIR_DEPARTURE.descending) * 165,
        lost,
    };
}

export function canEnterMeeting(s: { stage: number; mode: Mode; corridor: Readonly<Corridor>; p: Readonly<Point>; ground: boolean }) {
    return s.stage === 2 && s.mode === 'play' && s.corridor.room.kind === 'corridor'
        && s.corridor.convoy === 'free'
        && Math.abs(s.p.x - STAGE_TWO.meeting) < 125 && s.ground;
}

export const MEETING_SEAT: Readonly<Player> = Object.freeze({ x: STAGE_TWO.meeting - 100, y: 392, vx: 0, vy: 0, a: 0, w: 0 });

// Where the rider reappears in the corridor; pushed out when the meeting ends on its own.
export function meetingExit(returnX: number, pushed: boolean): Player {
    return { x: returnX + (pushed ? 110 : 0), y: 392, vx: pushed ? 180 : 0, vy: 0, a: 0, w: 0 };
}

// The optional meeting plays out by itself, then shoves the rider back into the corridor.
export function meetingStep(room: Exclude<Corridor['room'], { kind: 'corridor' }>, dt: number): { room: Corridor['room']; x: number; leave: boolean } {
    if (room.kind === 'entering') return meetingEntryStep(room, dt);
    const age = room.age + dt;
    return { room: { ...room, age }, x: STAGE_TWO.meeting - 100 + Math.max(0, age - 4.6) * 100, leave: age >= 6 };
}

function meetingEntryStep(room: Exclude<Corridor['room'], { kind: 'corridor' }>, dt: number) {
    const age = room.age + dt;
    if (age >= STAGE_TWO.meetingEntry) {
        return { room: { ...room, kind: 'meeting', age: age - STAGE_TWO.meetingEntry } satisfies Corridor['room'], x: MEETING_SEAT.x, leave: false };
    }
    const progress = Math.max(0, (age / STAGE_TWO.meetingEntry - .2) / .8);
    const glide = progress * progress * (3 - 2 * progress);
    return { room: { ...room, age }, x: room.returnX + (STAGE_TWO.meeting - room.returnX) * glide, leave: false };
}

export type CorridorInput = { corridor: Readonly<Corridor>; furniture: readonly Readonly<Furniture>[]; p: Readonly<Player>; ground: boolean; steering: boolean; rng: number; length: number };
export type CorridorResult = { corridor: Corridor; furniture: Furniture[]; p: Player; rng: number; stopRider: boolean; kick: 'bump' | 'trip' | null; tripped: number };

// The building corridor: typing bubbles, the chair convoy, its chatter and the lift ride.
// Works on its own copies; the caller writes the result back.
export function corridorStep(input: CorridorInput, dt: number, previousX: number): CorridorResult {
    const c = clonePlain(input.corridor) as Corridor;
    const furniture: Furniture[] = input.furniture.map(chair => ({ ...chair }));
    const p = { ...input.p };
    const ground = input.ground;
    let seed = input.rng;
    let stopRider = false;
    let kick: CorridorResult['kick'] = null;
    let tripped = -1;
    const random = () => {
        const draw = nextRandom(seed);
        seed = draw.state;
        return draw.value;
    };
    c.typingCooldown = Math.max(0, c.typingCooldown - dt);
    for (const office of c.offices) {
        office.life = Math.max(0, office.life - dt);
        office.cooldown = Math.max(0, office.cooldown - dt);
        const nearby = Math.abs(p.x - office.x) < 190;
        if (nearby && !office.nearby) office.cooldown = 0;
        office.nearby = nearby;
    }
    if (c.typingCooldown === 0 && !c.offices.some(office => office.life > 0)) {
        const office = c.offices.find(office => office.nearby && office.cooldown === 0);
        if (office) {
            office.phrase = (office.phrase + 1 + Math.floor(random() * (TYPING_SOUNDS.length - 1))) % TYPING_SOUNDS.length;
            const offsetX = (random() - .5) * 140;
            office.offset = { x: offsetX, y: 22 + random() * 132 };
            office.life = 1.5;
            office.cooldown = 4.5;
            c.typingCooldown = office.life + .3;
        }
    }
    if (p.x > STAGE_TWO.dispatch.trigger) c.dispatchStarted = true;
    if (c.dispatchStarted) {
        c.dispatchAge += dt;
        furniture.forEach((chair, i) => {
            if (!chair.released && c.dispatchAge >= .7 + i * .9) {
                chair.released = true;
                chair.vx = 170 + i * 15;
                chair.cheer = 2.4;
            }
        });
    }
    const allReleased = furniture.every(chair => chair.released);
    const front = furniture[0], back = furniture[2];
    const frontX = front.x;
    const nearby = p.x > back.x - 240 && p.x < front.x + 240;
    const leading = allReleased && ground && c.pace === 'casual' && leadsConvoy(p, furniture) && p.x >= STAGE_TWO.checkpoints[2].x;
    const captiveBoarding = c.departure.kind === 'boarding' && c.departure.reason === 'abduction';
    if (c.departure.kind !== 'none' && !captiveBoarding) {
        if (c.convoy !== 'airborne') c.convoy = 'free';
    } else if (allReleased && ground && !isJoinedConvoy(c.convoy) && c.convoy !== 'dropped') {
        c.convoy = insideConvoy(p, furniture) ? 'carried' : leading ? 'leading' : 'free';
    }
    if (c.departure.kind === 'none' && isJoinedConvoy(c.convoy) && c.pace === 'casual' && p.x >= STAGE_TWO.express.start) {
        c.pace = 'express';
        c.chat = { kind: 'rush', age: 0 };
        for (const chair of furniture) chair.vx = 360;
        p.vx = 360;
    }
    const minimumSpeed = 70;
    // Once welcomed, the chairs slow down for a rookie who fell off.
    const rookieAway = c.lesson >= 0 && (c.convoy === 'free' || c.convoy === 'dropped');
    for (const [index, chair] of furniture.entries()) {
        if (!chair.released) continue;
        chair.cheer = Math.max(0, chair.cheer - dt);
        if (c.departure.kind === 'gone' || c.departure.kind === 'lost' || c.departure.kind === 'descending') continue;
        if (c.departure.kind === 'boarding') {
            const target = STAGE_TWO.lift + CHAIR_DEPARTURE.slots[index];
            const speed = Math.max(-300, Math.min(300, (target - chair.x) * 4));
            chair.vx += (speed - chair.vx) * (1 - Det.exp(-8 * dt));
            chair.x += chair.vx * dt;
            chair.y = 420;
            continue;
        }
        const target = front.x - index * 130;
        const cruise = c.pace === 'express' ? 360 : !inOrientation(front.x) ? 185 : rookieAway ? ORIENTATION.wait : ORIENTATION.cruise;
        const speed = index === 0 ? cruise : Math.max(minimumSpeed, Math.min(cruise + 170, cruise + (target - chair.x) * 2));
        chair.vx += (speed - chair.vx) * (1 - Det.exp(-4 * dt));
        chair.x = Math.min(input.length + 450 + index * 130, chair.x + chair.vx * dt);
        if (c.convoy === 'free' && p.y > 350 && Math.abs(p.x - chair.x) < 58) {
            const side = previousX < chair.x ? 1 : -1;
            chair.x += side * (58 - Math.abs(p.x - chair.x)) * (1 - Det.exp(-14 * dt));
        }
        if (index > 0 && furniture[index - 1].released) chair.x = Math.min(chair.x, furniture[index - 1].x - 80);
        chair.y = 420;
    }
    const followsBoarding = captiveBoarding && c.convoy === 'airborne' && !input.steering;
    if (isJoinedConvoy(c.convoy) || followsBoarding) {
        const nextX = previousX + front.x - frontX;
        p.x = c.convoy === 'leading'
            ? Math.max(front.x + 29, Math.min(front.x + 239, nextX))
            : Math.max(back.x + 29, Math.min(front.x - 29, nextX));
        p.vx = front.vx;
    }
    if (isJoinedConvoy(c.convoy) && c.pace === 'express') {
        const express = STAGE_TWO.express;
        if (previousX < express.bump && p.x >= express.bump && ground) {
            // Clunk: the bump throws the heavy chair out of the convoy, spun and slowed; the empty chairs
            // roll on with no brakes and the rider, now on its own wheels, cannot catch them again.
            kick = 'bump';
            c.convoy = 'dropped';
            p.vy = -express.kick;
            p.y -= 4;  // off the floor now, so this tick's collisions do not set it back down
            p.vx = front.vx * express.drag;
            p.w += express.spin;
        } else if (previousX < express.pit.left && p.x >= express.pit.left) {
            c.convoy = 'free';
        } else if (overPit(p.x)) {
            c.convoy = 'free';
        }
    }
    const robot = ORIENTATION.robot;
    if (c.robot > ROBOT_GONE && (c.robot < robot.start || front.x >= robot.trigger || p.x >= robot.trigger + 200)) {
        c.robot -= robot.speed * dt;
        if (c.robot < robot.start - robot.range) c.robot = ROBOT_GONE;
    }
    const touched = touchedObstacle(p, c.robot);
    if (touched >= 0 && touched !== c.tripped && kick === null) {
        // Trip: a rider meeting an orientation obstacle low stumbles up and loses its speed.
        const joined = isJoinedConvoy(c.convoy) || c.convoy === 'airborne' || c.convoy === 'leading-airborne';
        kick = 'trip';
        tripped = touched;
        p.vy = -ORIENTATION.kick;
        p.y -= 4;
        p.vx = (joined ? front.vx : p.vx) * ORIENTATION.drag;
        p.w += ORIENTATION.spin;
        if (c.convoy !== 'dropped') c.convoy = 'free';
        if (c.chat.kind === 'orientation') {
            c.lesson = resumeLesson(c.chat);
            c.chat = { kind: 'trip', age: 0 };
        }
    }
    // One obstacle trips a rider once: it counts again only after the rider has rolled clear of it.
    if (c.tripped >= 0) {
        const obstacle = ORIENTATION.obstacles[c.tripped];
        if (Math.abs(p.x - obstacleX(obstacle, c.robot)) >= obstacle.width / 2 + RIDER_FOOT) c.tripped = -1;
    }
    if (tripped >= 0) c.tripped = tripped;
    // Once the whole convoy has rolled past the dropped rider, it is just a rider on foot again.
    if (c.convoy === 'dropped' && p.x < back.x - 30) c.convoy = 'free';
    if (c.departure.kind === 'none' && allReleased && c.chat.kind === 'waiting' && nearby) c.chat = { kind: 'gossip', age: 0 };
    if (c.departure.kind === 'none' && c.chat.kind !== 'waiting') {
        if (c.chat.kind === 'wary' && !isJoinedConvoy(c.convoy) && (p.x <= back.x + 28 || p.x >= front.x - 28)) {
            c.chat = { kind: 'dismissed', age: 0 };
        } else if (c.chat.kind === 'orientation') {
            c.chat = orientationStep(c.chat, front.x, dt);
            c.lesson = c.chat.line;
        } else {
            const speaker = chairChatLine(c.chat, c.appearanceSeed).speaker;
            if (Math.abs(furniture[speaker].x - p.x) < 240 || c.chat.kind === 'gossip' || c.chat.kind === 'trip' || c.chat.kind === 'dismissed' || c.chat.kind === 'rush' || c.chat.kind === 'ramp') c.chat.age += dt;
        }
        const lessonLeft = c.lesson >= 0 && c.lesson < ORIENTATION.lines.length;
        if ((c.chat.kind === 'gossip' || c.chat.kind === 'dismissed') && isJoinedConvoy(c.convoy)) {
            c.chat = c.lesson >= 0 ? (lessonLeft ? { kind: 'orientation', age: -1, line: c.lesson } : { kind: 'trip', age: 99 }) : { kind: 'wary', age: 0 };
        } else if (c.chat.kind === 'trip' && lessonLeft && isJoinedConvoy(c.convoy) && c.chat.age >= CHAIR_CHAT_INTERVAL.trip * CHAIR_CHAT.trip.length) {
            c.chat = { kind: 'orientation', age: -1, line: c.lesson };
        } else if (c.chat.kind === 'dismissed' && c.chat.age >= CHAIR_CHAT_INTERVAL.dismissed * CHAIR_CHAT.dismissed.length) c.chat = { kind: 'gossip', age: 0 };
        else if (c.chat.kind === 'wary' && c.chat.age >= 2.2) c.chat = { kind: 'realizing', age: 0 };
        else if (c.chat.kind === 'realizing' && c.chat.age >= 2.4) c.chat = { kind: 'welcoming', age: 0 };
        else if (c.chat.kind === 'welcoming' && c.chat.age >= 2) {
            c.lesson = Math.max(0, c.lesson);
            c.chat = { kind: 'orientation', age: -1, line: c.lesson };
        }
        else if (c.chat.kind === 'ramp' && c.chat.age >= CHAIR_CHAT_INTERVAL.ramp * CHAIR_CHAT.ramp.length) c.chat = { kind: 'rush', age: 0 };
        // The front chair nears the ramp: they shout back to the rookie.
        if (c.chat.kind === 'rush' && c.pace === 'express'
            && front.x >= STAGE_TWO.express.ramp.start - 300 && front.x < STAGE_TWO.express.pit.left) c.chat = { kind: 'ramp', age: 0 };
    }
    const recognized = c.lesson >= 0 || c.chat.kind === 'wary' || c.chat.kind === 'realizing' || c.chat.kind === 'welcoming' || c.chat.kind === 'rush' || c.chat.kind === 'ramp';
    if (c.departure.kind === 'boarding') {
        c.departure.age += dt;
        const aboard = furniture.every((chair, i) => Math.abs(chair.x - STAGE_TWO.lift - CHAIR_DEPARTURE.slots[i]) < 3 && Math.abs(chair.vx) < 8);
        const passengerReady = c.departure.reason !== 'abduction' || (ground && c.convoy === 'carried' && insideConvoy(p, furniture));
        if (c.departure.age >= CHAIR_DEPARTURE.boarding && aboard && passengerReady) {
            c.departure = { kind: 'descending', age: 0, reason: c.departure.reason };
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
    if (c.departure.kind === 'none' && c.lift.kind === 'waiting'
        && (p.x > STAGE_TWO.lift - 650 || (allReleased && front.x > STAGE_TWO.lift - 650))) c.lift = { kind: 'arriving', age: 0 };
    if (c.lift.kind === 'arriving') {
        c.lift.age += dt;
        if (c.lift.age >= 1.2) c.lift = { kind: 'open', age: 0 };
    } else if (c.departure.kind === 'none' && c.lift.kind === 'open') {
        c.lift.age += dt;
    }
    if (c.departure.kind === 'none' && allReleased && front.x >= STAGE_TWO.lift - 170
        && c.lift.kind === 'open' && c.lift.age >= 1 / 3) {
        const abducting = c.pace === 'express' && c.convoy !== 'free' && c.convoy !== 'dropped' && p.x > back.x + 28 && p.x < front.x - 28;
        c.departure = { kind: 'boarding', age: 0, reason: abducting ? 'abduction' : recognized ? 'companions' : 'clock-out' };
        if (!abducting) c.convoy = 'free';
    }
    return { corridor: c, furniture, p, rng: seed, stopRider, kick, tripped };
}
