import { LEVEL, PHYSICS } from './level';
import { clamp, contact } from './geometry';
import type { DeepReadonly, Player, Point } from './types';

// How the chair is driven this tick. Built by the play step from keys and stage rules.
export type Drive = {
    grounded: boolean;   // wheels touched the ground at the end of the last tick
    slip: boolean;       // rolling on spilled water
    dir: number;         // -1, 0, 1 wheel drive
    tilt: number;        // lean input, -1..1 plus air steering
    upright: boolean;    // tutorial and rooftop assist that rights the chair
    convoyJump: boolean; // leaping off the chair convoy carries its speed
    expressJump: boolean;
};

// One step of wheel drive, gravity, drag and limits. Pure: returns a new player.
export function drivePlayer(player: Readonly<Player>, d: Drive, dt: number): Player {
    const { lean, upright, drive, drag, spinDrag, limits } = PHYSICS;
    const p = { ...player };
    const was = d.grounded;
    p.w += d.tilt * (was ? lean.ground : lean.air) * dt;
    if (d.upright) {
        p.w += (-Math.sin(p.a) * upright.pull - p.w * upright.damping) * dt;
    }
    if (d.convoyJump && d.dir) {
        p.vx += d.dir * (d.expressJump ? drive.express : drive.convoy) * dt;
    } else if (was && d.dir) {
        p.vx += d.dir * (d.slip ? drive.slip : drive.ground) * dt;
    } else if (!was && d.dir) {
        p.vx += d.dir * drive.air * dt;
    }
    p.vy += PHYSICS.gravity * dt;
    p.vx *= Math.exp(-(d.convoyJump ? 0 : was ? (d.slip ? drag.slip : drag.ground) : drag.air) * dt);
    p.w *= Math.exp(-(was ? (d.slip ? spinDrag.slip : spinDrag.ground) : spinDrag.air) * dt);
    const horizontalLimit = d.expressJump ? limits.expressVx : d.convoyJump ? limits.convoyVx : limits.vx;
    p.vx = clamp(p.vx, -horizontalLimit, horizontalLimit);
    p.vy = clamp(p.vy, -limits.rise, limits.fall);
    p.w = clamp(p.w, -limits.spin, limits.spin);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.a += p.w * dt;
    return p;
}

export type Collision = { p: Player; ground: boolean; headHit: Point | null };

// Pushes the chair's contact circles out of the terrain with a springy impulse.
// A head pressed into a surface from above ends the attempt; `p` is where the chair was at that moment.
export function collide(player: Readonly<Player>, solids: readonly DeepReadonly<Point[]>[]): Collision {
    const { iterations, push, bounce, inertia, wheelGround, headDown, headDepth } = PHYSICS.contact;
    const p = { ...player };
    const parts = LEVEL.playerContacts;
    let ground = false;
    let c = Math.cos(p.a);
    let sn = Math.sin(p.a);
    const head = parts[7];
    const hx = p.x - head.y * sn;
    const hy = p.y + head.y * c;
    for (const ob of solids) {
        const hit = contact(hx, hy, head.r, ob);
        if (hit && hit.ny < headDown && hit.depth > headDepth) return { p, ground, headHit: { x: hx, y: hy } };
    }
    for (let iter = 0; iter < iterations; iter++) {
        for (const part of parts) {
            c = Math.cos(p.a);
            sn = Math.sin(p.a);
            const rx = part.x * c - part.y * sn;
            const ry = part.x * sn + part.y * c;
            for (const ob of solids) {
                const hit = contact(p.x + rx, p.y + ry, part.r, ob);
                if (!hit) continue;
                if (part.head && hit.ny < headDown && hit.depth > headDepth) return { p, ground, headHit: { x: p.x + rx, y: p.y + ry } };
                p.x += hit.nx * hit.depth * push;
                p.y += hit.ny * hit.depth * push;
                const vn = (p.vx - p.w * ry) * hit.nx + (p.vy + p.w * rx) * hit.ny;
                const cr = rx * hit.ny - ry * hit.nx;
                if (vn < 0) {
                    const impulse = -bounce * vn / (1 + cr * cr / inertia);
                    p.vx += hit.nx * impulse;
                    p.vy += hit.ny * impulse;
                    p.w += cr * impulse / inertia;
                }
                if (part.wheel && hit.ny < wheelGround) ground = true;
            }
        }
    }
    return { p, ground, headHit: null };
}

// Far below every floor: the attempt is lost (each stage decides how, see StageHooks.onFall).
export function fellOffFloor(p: Readonly<Point>) {
    return p.y > LEVEL.floor + PHYSICS.fallDepth;
}
