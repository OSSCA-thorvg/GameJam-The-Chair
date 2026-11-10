import { LEVEL } from './level';
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
    const p = { ...player };
    const was = d.grounded;
    p.w += d.tilt * (was ? 4.3 : 6.4) * dt;
    if (d.upright) {
        p.w += (-Math.sin(p.a) * 20 - p.w * 7) * dt;
    }
    if (d.convoyJump && d.dir) {
        p.vx += d.dir * (d.expressJump ? 1400 : 1200) * dt;
    } else if (was && d.dir) {
        p.vx += d.dir * (d.slip ? 110 : 305) * dt;
    } else if (!was && d.dir) {
        p.vx += d.dir * 55 * dt;
    }
    p.vy += 950 * dt;
    p.vx *= Math.exp(-(d.convoyJump ? 0 : was ? (d.slip ? .015 : .55) : .09) * dt);
    p.w *= Math.exp(-(was ? (d.slip ? .9 : 1.8) : .75) * dt);
    const horizontalLimit = d.expressJump ? 760 : d.convoyJump ? 700 : 315;
    p.vx = clamp(p.vx, -horizontalLimit, horizontalLimit);
    p.vy = clamp(p.vy, -500, 850);
    p.w = clamp(p.w, -5.8, 5.8);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.a += p.w * dt;
    return p;
}

export type Collision = { p: Player; ground: boolean; headHit: Point | null };

// Pushes the chair's contact circles out of the terrain with a springy impulse.
// A head pressed into a surface from above ends the attempt; `p` is where the chair was at that moment.
export function collide(player: Readonly<Player>, solids: readonly DeepReadonly<Point[]>[]): Collision {
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
        if (hit && hit.ny < -.25 && hit.depth > .05) return { p, ground, headHit: { x: hx, y: hy } };
    }
    for (let iter = 0; iter < 5; iter++) {
        for (const part of parts) {
            c = Math.cos(p.a);
            sn = Math.sin(p.a);
            const rx = part.x * c - part.y * sn;
            const ry = part.x * sn + part.y * c;
            for (const ob of solids) {
                const hit = contact(p.x + rx, p.y + ry, part.r, ob);
                if (!hit) continue;
                if (part.head && hit.ny < -.25 && hit.depth > .05) return { p, ground, headHit: { x: p.x + rx, y: p.y + ry } };
                p.x += hit.nx * hit.depth * .78;
                p.y += hit.ny * hit.depth * .78;
                const vn = (p.vx - p.w * ry) * hit.nx + (p.vy + p.w * rx) * hit.ny;
                const cr = rx * hit.ny - ry * hit.nx;
                if (vn < 0) {
                    const impulse = -1.035 * vn / (1 + cr * cr / 2500);
                    p.vx += hit.nx * impulse;
                    p.vy += hit.ny * impulse;
                    p.w += cr * impulse / 2500;
                }
                if (part.wheel && hit.ny < -.45) ground = true;
            }
        }
    }
    return { p, ground, headHit: null };
}
