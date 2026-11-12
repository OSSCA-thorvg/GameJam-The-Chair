import type { Input, Player } from '../../../types';
import * as Det from '../../../math';
import { STAGE_FIVE as C, type OrbitState } from '../data';

const clamp = (n: number, max: number) => Math.max(-max, Math.min(max, n));

export function orbitStep(orbit: Readonly<OrbitState>, player: Readonly<Player>, keys: readonly Input[], dt: number) {
    const next = { ...orbit, age: orbit.age + dt };
    const p = { ...player };
    const held = (key: Input) => keys.includes(key) ? 1 : 0;
    if (next.phase === 'parked') return { orbit: next, p, checkpoint: false };
    if (next.phase === 'entry' && next.age >= C.entryTime) next.phase = 'rings';
    const controlled = next.phase !== 'entry';
    const damping = Det.exp(-C.drag * dt);
    p.vx = (p.vx + (controlled ? held('right') - held('left') : 0) * C.acceleration * dt) * damping;
    p.vy = (p.vy + (controlled ? held('forward') - held('back') : 0) * C.acceleration * dt) * damping;
    p.x = clamp(p.x + p.vx * dt, C.bounds.x);
    p.y = clamp(p.y + p.vy * dt, C.bounds.y);
    if (Math.abs(p.x) === C.bounds.x) p.vx = 0;
    if (Math.abs(p.y) === C.bounds.y) p.vy = 0;
    p.a += (-p.vx / C.bankSpeed - p.a) * Math.min(1, dt * C.bankResponse);
    const arriving = next.phase === 'door' && next.z > C.door.z - C.arrivalDistance;
    const cruise = arriving ? C.arrivalSpeed : C.cruise;
    const thrust = controlled && held('spray') && !arriving;
    next.speed = Math.min(C.maxSpeed, next.speed + (thrust ? C.thrust : (cruise - next.speed) * C.cruiseRecovery) * dt);
    next.z += next.speed * dt;
    advanceRings(next, p);
    const checkpoint = arriveAtDoor(next, p);
    return { orbit: next, p, checkpoint };
}

function advanceRings(next: OrbitState, p: Player) {
    const ring = C.rings[next.rings];
    if (!ring || next.z < ring.z) return;
    if (Det.hypot(p.x - ring.x, p.y - ring.y) < ring.radius - C.ringClearance) {
        next.rings++;
        if (next.rings === C.rings.length) next.phase = 'door';
    } else {
        next.z = ring.z - 1;
        next.speed = Math.min(next.speed, C.approachSpeed);
    }
}

function arriveAtDoor(next: OrbitState, p: Player) {
    if (next.phase !== 'door' || next.z < C.checkpoint.z) return false;
    next.z = C.checkpoint.z;
    if (Det.hypot(p.x - C.door.x, p.y - C.door.y) > C.door.clearance) {
        next.speed = Math.min(next.speed, C.approachSpeed);
        return false;
    }
    next.phase = 'parked';
    next.settled = 1;
    next.speed = p.vx = p.vy = 0;
    return true;
}
