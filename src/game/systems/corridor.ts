import type { GameCore } from '../core';
import type { GameEvent } from '../types';
import { random } from '../rng';
import { STAGE_TWO, TYPING_SOUNDS, CHAIR_CHAT, CHAIR_CHAT_INTERVAL, CHAIR_DEPARTURE, chairChatLine } from '../stage2';

function insideConvoy(s: GameCore) {
    return s.p.y > 360 && s.p.x > s.furniture[2].x + 28 && s.p.x < s.furniture[0].x - 28;
}
export function landInConvoy(s: GameCore) {
    if (s.corridor.convoy !== 'airborne' || !s.ground) return;
    const departure = s.corridor.departure;
    const canCarry = departure.kind === 'none' || (departure.kind === 'boarding' && departure.reason === 'abduction');
    s.corridor.convoy = canCarry && insideConvoy(s) ? 'carried' : 'free';
    if (s.corridor.convoy === 'carried') s.p.vx = s.furniture[0].vx;
}
export function liftRideStep(s: GameCore, out: GameEvent[], dt: number) {
    const departure = s.corridor.departure;
    if (departure.kind !== 'descending' || departure.reason !== 'abduction') return false;
    departure.age += dt;
    s.p.y = 392 + Math.min(1, departure.age / CHAIR_DEPARTURE.descending) * 165;
    s.p.vx = s.p.vy = s.p.w = s.p.a = 0;
    s.ground = false;
    s.actualSpeed = 0;
    s.jumpQ = s.coyote = 0;
    if (departure.age >= CHAIR_DEPARTURE.descending) {
        s.corridor.departure = { kind: 'lost' };
        s.corridor.lift = { kind: 'departed' };
        s.corridor.convoy = 'free';
        s.mode = 'dead';
        s.lossReason = 'lift';
        s.deaths++;
        s.keys = [];
        out.push({ type: 'cue', id: 'lift-game-over' });
    }
    return true;
}
export function canEnterMeeting(s: GameCore) {
    return s.stage === 2 && s.mode === 'play' && s.corridor.room.kind === 'corridor'
        && s.corridor.convoy === 'free'
        && Math.abs(s.p.x - STAGE_TWO.meeting) < 125 && s.ground;
}
export function leaveMeeting(s: GameCore, pushed = false) {
    const room = s.corridor.room;
    if (room.kind !== 'meeting') return;
    s.p = { x: room.returnX + (pushed ? 110 : 0), y: 392, vx: pushed ? 180 : 0, vy: 0, a: 0, w: 0 };
    s.corridor.room = { kind: 'corridor' };
    s.keys = [];
    s.jumpQ = 0;
    s.ground = true;
    s.actualSpeed = 0;
}
export function interactMeeting(s: GameCore) {
    if (s.mode !== 'play') return;
    if (s.corridor.room.kind === 'meeting') { leaveMeeting(s); return; }
    if (!canEnterMeeting(s)) return;
    s.corridor.room = { kind: 'meeting', age: 0, returnX: s.p.x };
    s.corridor.meetingVisited = true;
    s.p = { x: STAGE_TWO.meeting - 100, y: 392, vx: 0, vy: 0, a: 0, w: 0 };
    s.keys = [];
    s.jumpQ = 0;
    s.actualSpeed = 0;
}
export function meetingStep(s: GameCore, dt: number) {
    const room = s.corridor.room;
    if (room.kind !== 'meeting') return false;
    room.age += dt;
    s.p.x = STAGE_TWO.meeting - 100 + Math.max(0, room.age - 4.6) * 100;
    if (room.age >= 6) leaveMeeting(s, true);
    return true;
}
export function corridorStep(s: GameCore, dt: number, previousX: number) {
    const c = s.corridor, p = s.p;
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
            office.phrase = (office.phrase + 1 + Math.floor(random(s.rng, 'cosmetic') * (TYPING_SOUNDS.length - 1))) % TYPING_SOUNDS.length;
            const offsetX = (random(s.rng, 'cosmetic') - .5) * 140;
            office.offset = { x: offsetX, y: 22 + random(s.rng, 'cosmetic') * 132 };
            office.life = 1.5;
            office.cooldown = 4.5;
            c.typingCooldown = office.life + .3;
        }
    }
    if (p.x > 320) c.dispatchStarted = true;
    if (c.dispatchStarted) {
        c.dispatchAge += dt;
        s.furniture.forEach((chair, i) => {
            if (!chair.released && c.dispatchAge >= .7 + i * .9) {
                chair.released = true;
                chair.vx = 170 + i * 15;
                chair.cheer = 2.4;
            }
        });
    }
    const allReleased = s.furniture.every(chair => chair.released);
    const front = s.furniture[0], back = s.furniture[2];
    const frontX = front.x;
    const captiveBoarding = c.departure.kind === 'boarding' && c.departure.reason === 'abduction';
    if (c.departure.kind !== 'none' && !captiveBoarding) {
        if (c.convoy !== 'airborne') c.convoy = 'free';
    } else if (allReleased && s.ground && c.convoy !== 'carried') c.convoy = insideConvoy(s) ? 'carried' : 'free';
    if (c.departure.kind === 'none' && c.convoy === 'carried' && c.pace === 'casual' && p.x >= STAGE_TWO.checkpoints[2].x) {
        c.pace = 'express';
        c.chat = { kind: 'rush', age: 0 };
        for (const chair of s.furniture) chair.vx = 360;
        p.vx = 360;
    }
    const minimumSpeed = 70;
    for (const [index, chair] of s.furniture.entries()) {
        if (!chair.released) continue;
        chair.cheer = Math.max(0, chair.cheer - dt);
        if (c.departure.kind === 'gone' || c.departure.kind === 'lost' || c.departure.kind === 'descending') continue;
        if (c.departure.kind === 'boarding') {
            const target = STAGE_TWO.lift + CHAIR_DEPARTURE.slots[index];
            const speed = Math.max(-300, Math.min(300, (target - chair.x) * 4));
            chair.vx += (speed - chair.vx) * (1 - Math.exp(-8 * dt));
            chair.x += chair.vx * dt;
            chair.y = 420;
            continue;
        }
        const target = front.x - index * 130;
        const cruise = c.pace === 'express' ? 360 : 185;
        const speed = index === 0 ? cruise : Math.max(minimumSpeed, Math.min(cruise + 170, cruise + (target - chair.x) * 2));
        chair.vx += (speed - chair.vx) * (1 - Math.exp(-4 * dt));
        chair.x = Math.min(s.LEN + 450 + index * 130, chair.x + chair.vx * dt);
        if (c.convoy === 'free' && p.y > 350 && Math.abs(p.x - chair.x) < 58) {
            const side = previousX < chair.x ? 1 : -1;
            chair.x += side * (58 - Math.abs(p.x - chair.x)) * (1 - Math.exp(-14 * dt));
        }
        if (index > 0 && s.furniture[index - 1].released) chair.x = Math.min(chair.x, s.furniture[index - 1].x - 80);
        chair.y = 420;
    }
    const followsBoarding = captiveBoarding && c.convoy === 'airborne' && !s.keys.includes('left') && !s.keys.includes('right');
    if (c.convoy === 'carried' || followsBoarding) {
        p.x = Math.max(back.x + 29, Math.min(front.x - 29, previousX + front.x - frontX));
        p.vx = front.vx;
    }
    if (captiveBoarding && (p.x <= back.x + 28 || p.x >= front.x - 28)) {
        if (c.departure.kind === 'boarding') c.departure.reason = 'companions';
        if (c.convoy !== 'airborne') c.convoy = 'free';
    }
    const nearby = p.x > back.x - 240 && p.x < front.x + 240;
    if (c.departure.kind === 'none' && allReleased && c.chat.kind === 'waiting' && nearby) c.chat = { kind: 'gossip', age: 0 };
    if (c.departure.kind === 'none' && c.chat.kind !== 'waiting') {
        if (c.chat.kind === 'wary' && (p.x <= back.x + 28 || p.x >= front.x - 28)) {
            c.chat = { kind: 'dismissed', age: 0 };
        } else {
            const speaker = chairChatLine(c.chat, c.appearanceSeed).speaker;
            if (Math.abs(s.furniture[speaker].x - p.x) < 240 || c.chat.kind === 'gossip' || c.chat.kind === 'companions' || c.chat.kind === 'dismissed' || c.chat.kind === 'rush') c.chat.age += dt;
        }
        if ((c.chat.kind === 'gossip' || c.chat.kind === 'dismissed') && c.convoy === 'carried') {
            c.chat = { kind: 'wary', age: 0 };
        } else if (c.chat.kind === 'dismissed' && c.chat.age >= CHAIR_CHAT_INTERVAL.dismissed * CHAIR_CHAT.dismissed.length) c.chat = { kind: 'gossip', age: 0 };
        else if (c.chat.kind === 'wary' && c.chat.age >= 2.2) c.chat = { kind: 'realizing', age: 0 };
        else if (c.chat.kind === 'realizing' && c.chat.age >= 2.8) c.chat = { kind: 'welcoming', age: 0 };
        else if (c.chat.kind === 'welcoming' && c.chat.age >= 2.4) c.chat = { kind: 'companions', age: 0 };
    }
    const recognized = c.chat.kind === 'wary' || c.chat.kind === 'realizing' || c.chat.kind === 'welcoming' || c.chat.kind === 'companions' || c.chat.kind === 'rush';
    if (c.departure.kind === 'boarding') {
        c.departure.age += dt;
        const aboard = s.furniture.every((chair, i) => Math.abs(chair.x - STAGE_TWO.lift - CHAIR_DEPARTURE.slots[i]) < 3 && Math.abs(chair.vx) < 8);
        const passengerReady = c.departure.reason !== 'abduction' || (s.ground && c.convoy === 'carried' && insideConvoy(s));
        if (c.departure.age >= CHAIR_DEPARTURE.boarding && aboard && passengerReady) {
            c.departure = { kind: 'descending', age: 0, reason: c.departure.reason };
            for (const chair of s.furniture) chair.vx = 0;
            if (c.departure.reason === 'abduction') {
                p.y = 392;
                p.vx = p.vy = p.a = p.w = 0;
                s.jumpQ = s.coyote = 0;
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
        const abducting = c.pace === 'express' && c.convoy !== 'free' && p.x > back.x + 28 && p.x < front.x - 28;
        c.departure = { kind: 'boarding', age: 0, reason: abducting ? 'abduction' : recognized ? 'companions' : 'clock-out' };
        if (!abducting) c.convoy = 'free';
    }
}
