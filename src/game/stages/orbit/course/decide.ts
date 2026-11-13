import type { Input, Player } from '../../../types';
import * as Det from '../../../math';
import { STAGE_FIVE as C, type OrbitState } from '../data';

const clamp = (n: number, max: number) => Math.max(-max, Math.min(max, n));

export function orbitStep(orbit: Readonly<OrbitState>, player: Readonly<Player>, keys: readonly Input[], dt: number) {
    const next = { ...orbit, age: orbit.age + dt };
    const p = { ...player };
    const held = (key: Input) => keys.includes(key) ? 1 : 0;
    // Parked in the Earth's shadow, `settled` counts on from 1 so the ending knows how far it has played.
    if (next.phase === 'parked') {
        next.settled += dt;
        return { orbit: next, p, checkpoint: false, praised: false };
    }
    if (next.phase === 'entry' && next.age >= C.entryTime) next.phase = C.rings.length ? 'rings' : 'door';
    const controlled = next.phase !== 'entry';
    // Steering grows from nothing to full over the entry, so the chair is under control right after the glide.
    const steer = controlled ? 1 : Math.min(1, next.age / C.entryTime);
    const damping = Det.exp(-C.drag * dt);
    p.vx = (p.vx + (held('right') - held('left')) * steer * C.acceleration * dt) * damping;
    p.vy = (p.vy + (held('forward') - held('back')) * steer * C.acceleration * dt) * damping;
    p.x = clamp(p.x + p.vx * dt, C.bounds.x);
    p.y = clamp(p.y + p.vy * dt, C.bounds.y);
    if (Math.abs(p.x) === C.bounds.x) p.vx = 0;
    if (Math.abs(p.y) === C.bounds.y) p.vy = 0;
    p.a += (-p.vx / C.bankSpeed - p.a) * Math.min(1, dt * C.bankResponse);
    const arriving = next.phase === 'door' && next.z > C.door.z - C.arrivalDistance;
    const cruise = arriving ? C.arrivalSpeed : C.cruise;
    const thrust = controlled && held('spray') && !arriving;
    next.speed = Math.min(C.maxSpeed, next.speed + (thrust ? C.thrust : (cruise - next.speed) * C.cruiseRecovery) * dt);
    const beam = controlled ? praiseBeamOn(next.age, p, next.z) : null;
    if (beam) praiseShove(next, p, beam, dt);
    const praised = beam !== null;
    next.z += next.speed * dt;
    advanceRings(next, p);
    const checkpoint = arriveAtDoor(next, p);
    return { orbit: next, p, checkpoint, praised };
}

type Beam = typeof C.praise.beams[number];

/** Lateral centre of a praise beam at `age` seconds into stage five. */
export function praiseBeamX(beam: Beam, age: number) {
    return beam.amplitude * Det.sin(age * beam.rate + beam.phase);
}

/** Whether the chair is tucked into one of the 5-1 shelter clouds, out of the satellites' sight. */
export function praiseSheltered(p: Readonly<Pick<Player, 'x' | 'y'>>, z: number) {
    const { shelters, shelterSize: size } = C.praise;
    return shelters.some(s => Math.abs(p.x - s.x) < size.x && Math.abs(p.y - s.y) < size.y && Math.abs(z - s.z) < size.z);
}

/** The beam falling on the chair at route depth `z`, if any. */
export function praiseBeamOn(age: number, p: Readonly<Pick<Player, 'x' | 'y'>>, z: number): Beam | null {
    if (praiseSheltered(p, z)) return null;
    for (const beam of C.praise.beams) {
        if (z >= beam.from && z <= beam.to && Math.abs(p.x - praiseBeamX(beam, age)) < beam.halfWidth) return beam;
    }
    return null;
}

/** Whether a praise beam is falling on the chair at route depth `z`. */
export function inPraise(age: number, p: Readonly<Pick<Player, 'x' | 'y'>>, z: number) {
    return praiseBeamOn(age, p, z) !== null;
}

/** The shower of praise slows the chair to a crawl and shoves it out of the beam's centre. */
function praiseShove(next: OrbitState, p: Player, beam: Beam, dt: number) {
    const { slowSpeed, slowResponse, shove } = C.praise;
    next.speed += (slowSpeed - next.speed) * Math.min(1, slowResponse * dt);
    p.vx += (p.x >= praiseBeamX(beam, next.age) ? 1 : -1) * shove * dt;
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
