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
        return { orbit: next, p, checkpoint: false, praised: false, spraying: false };
    }
    if (next.phase === 'entry' && next.age >= C.entryTime) next.phase = C.rings.length ? 'rings' : 'door';
    const controlled = next.phase !== 'entry';
    // Steering grows from nothing to full over the entry, so the chair is under control right after the glide.
    const steer = controlled ? 1 : Math.min(1, next.age / C.entryTime);
    const turning = (held('right') - held('left')) * steer;
    next.yaw += (turning * C.steer.turn - next.yaw) * (1 - Det.exp(-(turning !== 0 ? C.steer.response : C.steer.release) * dt));
    next.heading += next.yaw * dt;
    // Across, the chair only drifts on its own when something shoves it or the geofence pushes it back in.
    p.vx = steerAxis(p.vx, p.x, 0, C.bounds.x, dt);
    p.vy = steerAxis(p.vy, p.y, (held('forward') - held('back')) * steer, C.bounds.y, dt);
    p.a += (-next.yaw * C.bankTurn - p.a) * Math.min(1, dt * C.bankResponse);
    // Deep in the approach the Earth's shadow draws the chair in; before that only spraying moves it forward.
    // During the entry the glide from stage four still carries it at the speed it arrived with.
    const arriving = next.phase === 'door' && next.z > C.door.z - C.arrivalDistance;
    const thrust = controlled && held('spray') && !arriving;
    if (arriving) next.speed += (C.arrivalSpeed - next.speed) * C.cruiseRecovery * dt;
    else if (thrust) next.speed = Math.min(C.maxSpeed, next.speed + C.thrust * dt);
    else if (controlled) next.speed *= Det.exp(-C.coast * dt);
    const beam = controlled ? praiseBeamOn(next.age, p, next.z) : null;
    if (beam) praiseShove(next, p, beam, dt);
    const praised = beam !== null;
    p.x = clamp(p.x + (next.speed * Det.sin(next.heading) + p.vx) * dt, C.bounds.x + C.steer.overshoot);
    p.y = clamp(p.y + p.vy * dt, C.bounds.y + C.steer.overshoot);
    next.z = Math.max(C.steer.back - C.steer.overshoot, next.z + next.speed * Det.cos(next.heading) * dt);
    // Behind the start the geofence turns the chair's own motion back toward the shadow.
    if (next.z < C.steer.back) next.z += (C.steer.back - next.z) * C.steer.edge * dt;
    advanceRings(next, p);
    const checkpoint = arriveAtDoor(next, p);
    return { orbit: next, p, checkpoint, praised, spraying: thrust || !controlled };
}

type Beam = typeof C.praise.beams[number];

/**
 * One steering axis: chase the held direction's velocity, settle quickly on release, and past `bound` let the
 * company geofence push back harder the further out the chair is.
 */
function steerAxis(v: number, at: number, input: number, bound: number, dt: number) {
    const over = Math.max(0, Math.abs(at) - bound) * Math.sign(at);
    const target = input * C.steer.speed - over * C.steer.edge;
    const rate = input !== 0 || over !== 0 ? C.steer.response : C.steer.release;
    return v + (target - v) * (1 - Det.exp(-rate * dt));
}

/** Centre of a praise beam along its own axis (across for `x`, up for `y`) at `age` seconds into stage five. */
export function praiseBeamX(beam: Beam, age: number) {
    return beam.amplitude * Det.sin(age * beam.rate + beam.phase);
}

const along = (beam: Beam, p: Readonly<Pick<Player, 'x' | 'y'>>) => beam.axis === 'y' ? p.y : p.x;
/** How far out from the satellite: y for a down beam, x for a side beam. */
const reachOf = (beam: Beam, p: Readonly<Pick<Player, 'x' | 'y'>>) => beam.axis === 'y' ? p.x : p.y;

/** The point the light spreads from, the satellite's lens: across the sweep, out from the satellite, and route depth. */
export function praiseApex(beam: Beam) {
    const { x, y, z } = beam.satellite;
    return beam.axis === 'y'
        ? { across: y, reach: x - Math.sign(x) * C.praise.lens, z }
        : { across: x, reach: y - C.praise.lens, z };
}

/**
 * The beam's slice at `reach` (0 is the middle of the play area): its centre across the sweep, half width, and the
 * route depths it covers. The light is a tent from the lens, so the slice scales with the distance from it.
 */
export function praiseSection(beam: Beam, age: number, reach: number) {
    const apex = praiseApex(beam), scale = (apex.reach - reach) / apex.reach;
    return {
        scale,
        centre: apex.across + (praiseBeamX(beam, age) - apex.across) * scale,
        halfWidth: beam.halfWidth * scale,
        from: apex.z + (beam.from - apex.z) * scale,
        to: apex.z + (beam.to - apex.z) * scale,
    };
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
        const slice = praiseSection(beam, age, reachOf(beam, p));
        if (slice.scale > 0 && z >= slice.from && z <= slice.to && Math.abs(along(beam, p) - slice.centre) < slice.halfWidth) return beam;
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
    const push = (along(beam, p) >= praiseSection(beam, next.age, reachOf(beam, p)).centre ? 1 : -1) * shove * dt;
    if (beam.axis === 'y') p.vy += push;
    else p.vx += push;
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
    next.speed = next.yaw = p.vx = p.vy = 0;
    return true;
}
