import type { Input, Player } from '../../../types';
import * as Det from '../../../math';
import { STAGE_FIVE as C, type OrbitState } from '../data';

type Beam = typeof C.satelliteLight.beams[number];

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
    p.vx = steerAxis(p.vx, p.x, (held('right') - held('left')) * steer, -C.bounds.x, C.bounds.x, dt);
    p.vy = steerAxis(p.vy, p.y, (held('forward') - held('back')) * steer, -C.bounds.y, C.bounds.y, dt);
    // Sliding across, the chair banks into the slide.
    p.a += (-p.vx * C.bankSlide - p.a) * Math.min(1, dt * C.bankResponse);
    // Until the autopilot takes over only spraying moves the chair forward.
    // During the entry the glide from stage four still carries it at the speed it arrived with.
    const thrust = controlled && !auto && held('spray');
    next.idle = controlled && !auto && !thrust ? next.idle + dt : 0;
    const top = gearAt(next.z).maxSpeed;
    const landing = auto ? Math.max(C.autopilot.landing, Math.min(C.cruise, (C.checkpoint.z - next.z) * C.autopilot.brake)) : 0;
    if (auto) next.speed += (landing - next.speed) * (1 - Det.exp(-C.autopilot.response * dt));
    else if (thrust) next.speed = Math.min(top, next.speed + C.thrust * dt);
    else if (controlled) next.speed *= Det.exp(-C.coast * dt);
    const beam = controlled ? satelliteLightOn(next.age, p, next.z) : null;
    if (beam) satelliteLightShove(next, p, beam, dt);
    const satelliteLit = beam !== null;
    p.x = Math.max(-C.bounds.x - C.steer.overshoot, Math.min(C.bounds.x + C.steer.overshoot, p.x + p.vx * dt));
    p.y = Math.max(-C.bounds.y - C.steer.overshoot, Math.min(C.bounds.y + C.steer.overshoot, p.y + p.vy * dt));
    next.z += next.speed * dt;
    advanceRings(next, p);
    const checkpoint = arriveAtDoor(next, p);
    // The autopilot fires the extinguisher itself whenever it is bringing the chair up to speed.
    return { orbit: next, p, checkpoint, satelliteLit, spraying: thrust || !controlled || (auto && next.speed < landing - 1) };
}

/** The gear the route is in at depth `z`: its top speed rises from one stretch to the next. */
export function gearAt(z: number) {
    let index = 0;
    for (let i = 0; i < C.gears.length; i++) if (z >= C.gears[i].from) index = i;
    return { index, ...C.gears[index] };
}

/** Whether the company autopilot is flying the chair: from the edge of the Earth's shadow until it parks. */
export function autopilot(orbit: Readonly<OrbitState>) {
    return orbit.phase === 'door' && orbit.z >= C.autopilot.from;
}

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

/** Where the middle of the beam is along its sweep: across for an overhead beam, up for a side beam. */
export function satelliteLightSweep(beam: Beam, age: number) {
    return beam.amplitude * Det.sin(age * beam.rate + beam.phase);
}

/** The chair's position along a beam's sweep. */
export const satelliteLightAlong = (beam: Beam, p: Readonly<Pick<Player, 'x' | 'y'>>) => beam.axis === 'y' ? p.y : p.x;

/** The beam on the play plane: a band `centre ± halfWidth` along its axis, wherever it is along the other one. */
export function satelliteLightBand(beam: Beam, age: number) {
    return { axis: beam.axis, centre: satelliteLightSweep(beam, age), halfWidth: beam.halfWidth };
}

/** Seconds until the chair at depth `z` and `speed` reaches the beam: negative once inside it. */
export function satelliteLightArrival(beam: Beam, z: number, speed: number) {
    return (beam.from - z) / Math.max(C.cruise * .4, speed);
}

/** The beam falling on the chair at route depth `z`, if any: its band overlaps the chair. */
export function satelliteLightOn(age: number, p: Readonly<Pick<Player, 'x' | 'y'>>, z: number): Beam | null {
    for (const beam of C.satelliteLight.beams) {
        if (z < beam.from || z > beam.to) continue;
        if (Math.abs(satelliteLightAlong(beam, p) - satelliteLightSweep(beam, age)) < beam.halfWidth + C.satelliteLight.chairRadius) return beam;
    }
    return null;
}

export function inSatelliteLight(age: number, p: Readonly<Pick<Player, 'x' | 'y'>>, z: number) {
    return satelliteLightOn(age, p, z) !== null;
}

function satelliteLightShove(next: OrbitState, p: Player, beam: Beam, dt: number) {
    const { slowSpeed, slowResponse, shove } = C.satelliteLight;
    next.speed += (slowSpeed - next.speed) * Math.min(1, slowResponse * dt);
    const push = (satelliteLightAlong(beam, p) >= satelliteLightSweep(beam, next.age) ? 1 : -1) * shove * dt;
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
    next.speed = p.vx = p.vy = 0;
    return true;
}
