import type { Input, Player } from '../../../types';
import * as Det from '../../../math';
import { STAGE_FIVE as C } from '../data';
import type { OrbitState } from '../data';

const clamp = (n: number, max: number) => Math.max(-max, Math.min(max, n));

export function orbitStep(orbit: Readonly<OrbitState>, player: Readonly<Player>, keys: readonly Input[], dt: number) {
    const next = { ...orbit, age: orbit.age + dt };
    const p = { ...player };
    const held = (key: Input) => keys.includes(key) ? 1 : 0;
    const brake = held('brake') === 1;
    if (next.phase === 'parked') return { orbit: next, p, checkpoint: false };
    if (next.phase === 'entry' && next.age >= C.entryTime) next.phase = 'rings';
    const controlled = next.phase !== 'entry';
    const damping = Det.exp(-(brake ? C.braking : C.drag) * dt);
    p.vx = (p.vx + (controlled ? held('right') - held('left') : 0) * C.acceleration * dt) * damping;
    p.vy = (p.vy + (controlled ? held('forward') - held('back') : 0) * C.acceleration * dt) * damping;
    p.x = clamp(p.x + p.vx * dt, C.bounds.x);
    p.y = clamp(p.y + p.vy * dt, C.bounds.y);
    if (Math.abs(p.x) === C.bounds.x) p.vx = 0;
    if (Math.abs(p.y) === C.bounds.y) p.vy = 0;
    p.a += (-p.vx / C.bankSpeed - p.a) * Math.min(1, dt * C.bankResponse);
    next.speed = brake ? next.speed * Det.exp(-C.braking * dt)
        : Math.min(C.maxSpeed, next.speed + (controlled && held('spray') ? C.thrust : (C.cruise - next.speed) * C.cruiseRecovery) * dt);
    next.z += next.speed * dt;
    advanceRings(next, p);
    const checkpoint = settleDrawer(next, p, dt);
    return { orbit: next, p, checkpoint };
}

function advanceRings(next: OrbitState, p: Player) {
    const ring = C.rings[next.rings];
    if (!ring || next.z < ring.z) return;
    if (Det.hypot(p.x - ring.x, p.y - ring.y) < ring.radius - C.ringClearance) {
        next.rings++;
        if (next.rings === C.rings.length) next.phase = 'drawer';
    } else {
        next.z = ring.z - 1;
        next.speed = Math.min(next.speed, C.approachSpeed);
    }
}

function settleDrawer(next: OrbitState, p: Player, dt: number) {
    if (next.phase !== 'drawer' || next.z < C.drawer.z) return false;
    const inside = Math.abs(p.x - C.drawer.x) < C.drawer.width / 2 - C.drawerClearance
        && Math.abs(p.y - C.drawer.y) < C.drawer.height / 2 - C.drawerClearance;
    if (!inside) {
        next.z = Math.min(next.z, C.drawer.z - 1);
        next.speed = Math.min(next.speed, C.approachSpeed);
        next.settled = 0;
        return false;
    }
    if (next.z > C.drawer.z + C.drawer.depth - C.cushionDepth) {
        next.z = C.drawer.z + C.drawer.depth - C.cushionDepth;
        next.speed *= Det.exp(-C.cushionDrag * dt);
        p.vx *= Det.exp(-C.cushionDrag * dt);
        p.vy *= Det.exp(-C.cushionDrag * dt);
    }
    const slow = Det.hypot(Det.hypot(p.vx, p.vy), next.speed) < C.stopSpeed;
    next.settled = slow ? next.settled + dt : 0;
    if (next.settled < C.settleTime) return false;
    next.phase = 'parked';
    next.speed = p.vx = p.vy = 0;
    return true;
}
