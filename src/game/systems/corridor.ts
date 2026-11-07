import type { GameCore } from '../core';
import { STAGE_TWO } from '../stage2';
import { focusHit } from './focus';

export function canEnterMeeting(s: GameCore) {
    return s.stage === 2 && s.mode === 'play' && s.corridor.room.kind === 'corridor'
        && Math.abs(s.p.x - STAGE_TWO.meeting) < 125 && s.ground;
}
export function leaveMeeting(s: GameCore, pushed = false) {
    const room = s.corridor.room;
    if (room.kind !== 'meeting') return;
    s.p = { x: room.returnX + (pushed ? 110 : 0), y: 392, vx: pushed ? 180 : 0, vy: 0, a: 0, w: 0 };
    s.corridor.room = { kind: 'corridor' };
    s.keys.clear();
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
    s.keys.clear();
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
    for (const office of c.offices) {
        office.life = Math.max(0, office.life - dt);
        office.cooldown = Math.max(0, office.cooldown - dt);
        const nearby = Math.abs(p.x - office.x) < 190;
        if (nearby && (!office.nearby || office.cooldown === 0)) {
            office.life = 1.5;
            office.cooldown = 4.5;
        }
        office.nearby = nearby;
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
    for (const chair of s.furniture) {
        if (!chair.released) continue;
        chair.cheer = Math.max(0, chair.cheer - dt);
        chair.x += chair.vx * dt;
        chair.vx *= Math.exp(-.55 * dt);
        if (Math.abs(p.x - chair.x) < 66 && p.y > 350) {
            const side = previousX < chair.x ? -1 : 1;
            chair.vx += (p.vx - chair.vx) * dt * 8;
            p.x = chair.x + side * 66;
            p.vx *= Math.exp(-.35 * dt);
        }
        chair.x = Math.min(s.LEN + 100, chair.x);
    }
    for (let i = 1; i < s.furniture.length; i++) {
        const a = s.furniture[i - 1], b = s.furniture[i];
        if (a.released && b.released && Math.abs(a.x - b.x) < 48) {
            const sign = a.x < b.x ? 1 : -1;
            b.x = a.x + sign * 48;
            b.vx = a.vx = (a.vx + b.vx) / 2;
        }
    }
    const scan = c.scanner;
    if (!scan.approved) {
        const inZone = p.x > STAGE_TWO.scanner - 200 && p.x < STAGE_TWO.scanner && s.ground;
        const neutral = !s.keys.has('left') && !s.keys.has('right');
        if (inZone && neutral) p.vx *= Math.exp(-7 * dt);
        scan.progress = inZone && neutral && Math.abs(p.vx) < 20 ? Math.min(1, scan.progress + dt / 1.1) : 0;
        if (scan.progress >= 1) scan.approved = true;
        if (!scan.approved && p.x > STAGE_TWO.scanner - 52) {
            p.x = STAGE_TWO.scanner - 52;
            p.vx = Math.min(0, p.vx);
        }
    }
    if (c.lift.kind === 'waiting' && p.x > STAGE_TWO.lift - 650) c.lift = { kind: 'arriving', age: 0 };
    if (c.lift.kind === 'arriving') {
        c.lift.age += dt;
        if (c.lift.age >= 1.2) {
            c.lift = { kind: 'open', age: 0 };
            c.cart = { x: STAGE_TWO.lift, hit: false };
        }
    } else if (c.lift.kind === 'open') {
        c.lift.age += dt;
        if (c.lift.age >= 4) c.lift = { kind: 'departed' };
    }
    if (c.cart) {
        c.cart.x -= 220 * dt;
        if (!c.cart.hit && Math.abs(p.x - c.cart.x) < 60 && p.y + 28 > 363) {
            c.cart.hit = true;
            p.vx = -90;
            focusHit(s, 'cart', ++c.cartHits);
        }
        if (c.cart.x < STAGE_TWO.lift - 650) c.cart = null;
    }
}
