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
        next.idle = 0;
        return { orbit: next, p, checkpoint: false, satelliteLit: false, spraying: false };
    }
    if (next.phase === 'entry' && next.age >= C.entryTime) next.phase = C.rings.length ? 'rings' : 'door';
    const controlled = next.phase !== 'entry';
    const auto = autopilot(next);
    // Steering grows from nothing to full over the entry, so the chair is under control right after the glide.
    const steer = auto ? 0 : controlled ? 1 : Math.min(1, next.age / C.entryTime);
    const turning = (held('right') - held('left')) * steer;
    if (auto) next.yaw = -next.heading * C.autopilot.turn;
    else next.yaw += (turning * C.steer.turn - next.yaw) * (1 - Det.exp(-(turning !== 0 ? C.steer.response : C.steer.release) * dt));
    next.heading += next.yaw * dt;
    if (Math.abs(next.heading) >= C.steer.heading) {
        next.heading = Math.sign(next.heading) * C.steer.heading;
        if (next.yaw * next.heading > 0) next.yaw = 0;
    }
    // Across, the chair only drifts on its own when something shoves it or the geofence pushes it back in.
    p.vx = steerAxis(p.vx, p.x, 0, -C.bounds.x, C.bounds.x, dt);
    p.vy = steerAxis(p.vy, p.y, (held('forward') - held('back')) * steer, -C.bounds.y, C.bounds.top, dt);
    p.a += (-next.yaw * C.bankTurn - p.a) * Math.min(1, dt * C.bankResponse);
    // Until the autopilot takes over only spraying moves the chair forward.
    // During the entry the glide from stage four still carries it at the speed it arrived with.
    const thrust = controlled && !auto && held('spray');
    next.idle = controlled && !auto && !thrust ? next.idle + dt : 0;
    const landing = auto ? Math.max(C.autopilot.landing, Math.min(C.cruise, (C.checkpoint.z - next.z) * C.autopilot.brake)) : 0;
    if (auto) next.speed += (landing - next.speed) * (1 - Det.exp(-C.autopilot.response * dt));
    else if (thrust) next.speed = Math.min(C.maxSpeed, next.speed + C.thrust * dt);
    else if (controlled) next.speed *= Det.exp(-C.coast * dt);
    const beam = controlled ? satelliteLightOn(next.age, p, next.z) : null;
    if (beam) satelliteLightShove(next, p, beam, dt);
    const satelliteLit = beam !== null;
    p.x = clamp(p.x + (next.speed * Det.sin(next.heading) + p.vx) * dt, C.bounds.x + C.steer.overshoot);
    p.y = Math.max(-C.bounds.y - C.steer.overshoot, Math.min(C.bounds.top + C.steer.overshoot, p.y + p.vy * dt));
    next.z += next.speed * Det.cos(next.heading) * dt;
    advanceRings(next, p);
    const checkpoint = arriveAtDoor(next, p);
    // The autopilot fires the extinguisher itself whenever it is bringing the chair up to speed.
    return { orbit: next, p, checkpoint, satelliteLit, spraying: thrust || !controlled || (auto && next.speed < landing - 1) };
}

/** Whether the company autopilot is flying the chair: from the edge of the Earth's shadow until it parks. */
export function autopilot(orbit: Readonly<OrbitState>) {
    return orbit.phase === 'door' && orbit.z >= C.autopilot.from;
}

type Beam = typeof C.satelliteLight.beams[number];

/**
 * One steering axis: chase the held direction's velocity, settle quickly on release, and past `low` or `high` let the
 * company geofence push back harder the further out the chair is.
 */
function steerAxis(v: number, at: number, input: number, low: number, high: number, dt: number) {
    const over = at > high ? at - high : at < low ? at - low : 0;
    const target = input * C.steer.speed - over * C.steer.edge;
    const rate = input !== 0 || over !== 0 ? C.steer.response : C.steer.release;
    return v + (target - v) * (1 - Det.exp(-rate * dt));
}

export function satelliteLightSweep(beam: Beam, age: number) {
    return beam.amplitude * Det.sin(age * beam.rate + beam.phase);
}

const along = (beam: Beam, p: Readonly<Pick<Player, 'x' | 'y'>>) => beam.axis === 'y' ? p.y : p.x;
/** How far out from the satellite: y for a down beam, x for a side beam. */
const reachOf = (beam: Beam, p: Readonly<Pick<Player, 'x' | 'y'>>) => beam.axis === 'y' ? p.x : p.y;

/** The point the light spreads from, the satellite's lens: across the sweep, out from the satellite, and route depth. */
export function satelliteLightApex(beam: Beam) {
    const { x, y, z } = beam.satellite;
    return beam.axis === 'y'
        ? { across: y, reach: x - Math.sign(x) * C.satelliteLight.lens, z }
        : { across: x, reach: y - C.satelliteLight.lens, z };
}

/**
 * The beam's slice at `reach` (0 is the middle of the play area): its centre across the sweep, half width, and the
 * route depths it covers. The light is a tent from the lens, so the slice scales with the distance from it.
 */
export function satelliteLightSection(beam: Beam, age: number, reach: number) {
    const apex = satelliteLightApex(beam), scale = (apex.reach - reach) / apex.reach;
    return {
        scale,
        centre: apex.across + (satelliteLightSweep(beam, age) - apex.across) * scale,
        halfWidth: beam.halfWidth * scale,
        from: apex.z + (beam.from - apex.z) * scale,
        to: apex.z + (beam.to - apex.z) * scale,
    };
}

/** Whether the chair is tucked into one of the 5-1 shelter clouds, out of the satellites' sight. */
export function satelliteLightSheltered(p: Readonly<Pick<Player, 'x' | 'y'>>, z: number) {
    const { shelters, shelterSize: size } = C.satelliteLight;
    return shelters.some(s => Math.abs(p.x - s.x) < size.x && Math.abs(p.y - s.y) < size.y && Math.abs(z - s.z) < size.z);
}

/** The beam falling on the chair at route depth `z`, if any. */
export function satelliteLightOn(age: number, p: Readonly<Pick<Player, 'x' | 'y'>>, z: number): Beam | null {
    if (satelliteLightSheltered(p, z)) return null;
    for (const beam of C.satelliteLight.beams) {
        const slice = satelliteLightSection(beam, age, reachOf(beam, p));
        if (slice.scale > 0 && z >= slice.from && z <= slice.to && Math.abs(along(beam, p) - slice.centre) < slice.halfWidth) return beam;
    }
    return null;
}

export function inSatelliteLight(age: number, p: Readonly<Pick<Player, 'x' | 'y'>>, z: number) {
    return satelliteLightOn(age, p, z) !== null;
}

function satelliteLightShove(next: OrbitState, p: Player, beam: Beam, dt: number) {
    const { slowSpeed, slowResponse, shove } = C.satelliteLight;
    next.speed += (slowSpeed - next.speed) * Math.min(1, slowResponse * dt);
    const push = (along(beam, p) >= satelliteLightSection(beam, next.age, reachOf(beam, p)).centre ? 1 : -1) * shove * dt;
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
