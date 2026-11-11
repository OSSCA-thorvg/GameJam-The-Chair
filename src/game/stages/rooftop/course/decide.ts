import type { Player } from '../../../types';
import { GRAPH_LENGTH, STAGE_THREE, ductTimings, graphCatch, graphPointAt, inVentBlast, ventPhase, type DuctBurst } from '../data';
import { STAGE_FOUR } from '../../sky/data';

export type RooftopEntrance = { kind: 'opening'; age: number } | { kind: 'ready' };
// 'course' is normal play; 'ride' carries the chair up the sales graph (`dist` along the line);
// 'flight' is the climb from the graph's tip up to the sky stage.
export type FirstFlight = { kind: 'course' } | { kind: 'ride'; dist: number; speed: number; age: number } | { kind: 'flight'; age: number };
// `rest` counts the seconds since the last sneeze; an awake duct gusts again after `gustPeriod`.
export type DuctReaction = { kind: 'idle' } | { kind: 'reacting'; age: number; shots: number; bursts: DuctBurst[] } | { kind: 'done'; shots: number; rest: number };

const cloneReaction = (reaction: Readonly<DuctReaction>): DuctReaction =>
    reaction.kind === 'reacting' ? { ...reaction, bursts: reaction.bursts.map(burst => ({ ...burst })) } : { ...reaction };

// The hinged rooftop door opens and the chair rolls out on its own; controls wait until it closes.
export function entranceStep(entrance: { kind: 'opening'; age: number }, dt: number): { entrance: RooftopEntrance; pose: Player; done: boolean } {
    const e = STAGE_THREE.entrance;
    const age = Math.min(e.duration, entrance.age + dt);
    const progress = Math.max(0, Math.min(1, (age - e.emergeAt) / (e.emergeEnd - e.emergeAt)));
    const ease = progress * progress * (3 - 2 * progress);
    const done = age >= e.duration;
    const pose = {
        x: e.fromX + (e.toX - e.fromX) * ease,
        y: STAGE_THREE.checkpoints[0].y,
        vx: done ? 0 : (e.toX - e.fromX) * 6 * progress * (1 - progress) / (e.emergeEnd - e.emergeAt),
        vy: 0, a: 0, w: 0,
    };
    return { entrance: done ? { kind: 'ready' } : { kind: 'opening', age }, pose, done };
}

export type RooftopInput = { p: Readonly<Player>; ground: boolean; hasExtinguisher: boolean; firstFlight: Readonly<FirstFlight>; ductReaction: Readonly<DuctReaction>; time: number };
export type RooftopResult = { p: Player; ground: boolean; firstFlight: FirstFlight; ductReaction: DuctReaction; pickup: boolean };

// After collisions on the rooftop: the duct's sneeze, the steam vents, the extinguisher pickup, the ceiling
// and the catch onto the sales graph.
export function rooftopStep(input: RooftopInput, dt: number): RooftopResult {
    const duct = ductReactionStep(input.ductReaction, input.p, dt);
    const p = duct.p;
    for (const vent of STAGE_THREE.vents) {
        if (ventPhase(vent, input.time).kind !== 'blow' || !inVentBlast(vent, p)) continue;
        if (vent.axis === 'x') p.vx += vent.dir * vent.force * dt;
        else p.vy += vent.dir * vent.force * dt;
    }
    const ground = duct.knocked ? false : input.ground;
    const pickup = !input.hasExtinguisher && Math.abs(p.x - STAGE_THREE.pickup.x) < 55 && Math.abs(p.y - STAGE_THREE.pickup.y) < 75;
    if (p.y < STAGE_THREE.ceiling) {
        p.y = STAGE_THREE.ceiling;
        p.vy = Math.max(0, p.vy);
    }
    let firstFlight: FirstFlight = { ...input.firstFlight };
    // Falling off the roof onto the slumping sales graph starts the ride.
    const caught = firstFlight.kind === 'course' && input.hasExtinguisher && p.vy >= 0 ? graphCatch(p) : null;
    if (caught !== null) firstFlight = { kind: 'ride', dist: caught, speed: Math.max(STAGE_THREE.graph.startSpeed, Math.abs(p.vx)), age: 0 };
    return { p, ground, firstFlight, ductReaction: duct.reaction, pickup };
}

// The chair rides the surging sales graph: it sticks to the line, speeds up, and leaves the tip
// heading up into the climb.
export function graphRideStep(ride: Readonly<Extract<FirstFlight, { kind: 'ride' }>>, p: Readonly<Player>, dt: number): { flight: FirstFlight; p: Player } {
    const g = STAGE_THREE.graph;
    const speed = Math.min(g.topSpeed, ride.speed + g.accel * dt);
    const dist = ride.dist + speed * dt;
    const at = graphPointAt(dist);
    // The chair turns smoothly into each corner; the seat sits above the line along its own tilt.
    const a = p.a + (Math.atan2(at.ty, at.tx) - p.a) * (1 - Math.exp(-14 * dt));
    const next = { ...p, x: at.x + Math.sin(a) * 28, y: at.y - Math.cos(a) * 28, vx: at.tx * speed, vy: at.ty * speed, a, w: 0 };
    if (dist < GRAPH_LENGTH) return { flight: { kind: 'ride', dist, speed, age: ride.age + dt }, p: next };
    next.vy = Math.min(next.vy, -320);
    return { flight: { kind: 'flight', age: 0 }, p: next };
}

// The climb from the graph's tip up to the sky stage, drifting back over the roof where it starts.
export function flightStep(flight: { kind: 'flight'; age: number }, p: Readonly<Player>, dt: number): { flight: FirstFlight; p: Player; arrived: boolean } {
    const next = { ...p };
    next.vx += ((STAGE_FOUR.spawn.x - next.x) * .9 - next.vx) * (1 - Math.exp(-2 * dt));
    next.x += next.vx * dt;
    const remaining = Math.max(0, next.y - STAGE_FOUR.arrivalY);
    const targetSpeed = -Math.min(300, Math.max(35, remaining * 1.5));
    next.vy += (targetSpeed - next.vy) * (1 - Math.exp(-2.5 * dt));
    next.y += next.vy * dt;
    next.a += (0 - next.a) * dt * 5;
    return { flight: { kind: 'flight', age: flight.age + dt }, p: next, arrived: next.y <= STAGE_FOUR.arrivalY };
}

// Spraying into the front of the rooftop duct makes it sneeze. Repeat sprays queue weaker sneezes.
// The sleeping duct wakes from further away; once awake it only answers sprays close in front,
// so it never turns into a wall the rider cannot spray past.
export function ductSprayed(reaction: Readonly<DuctReaction>, p: Readonly<Player>): DuctReaction {
    const duct = STAGE_THREE.duct;
    const dx = duct.x - p.x;
    const asleep = reaction.kind === 'idle';
    const reach = asleep ? duct.wakeReach : duct.frontReach;
    const height = asleep ? duct.wakeHeight : duct.frontHeight;
    if (dx < -duct.rearReach || dx > reach || Math.abs(p.y - duct.y) > height) return cloneReaction(reaction);
    if (reaction.kind === 'idle') return { kind: 'reacting', age: 0, shots: 1, bursts: [{ kind: 'first', age: 0 }] };
    if (reaction.kind === 'done') return { kind: 'reacting', age: 10, shots: reaction.shots + 1, bursts: [{ kind: 'repeat', age: 0 }] };
    const next = cloneReaction(reaction) as Extract<DuctReaction, { kind: 'reacting' }>;
    next.shots++;
    next.bursts.push({ kind: 'repeat', age: 0 });
    return next;
}

function ductReactionStep(input: Readonly<DuctReaction>, player: Readonly<Player>, dt: number): { reaction: DuctReaction; p: Player; knocked: boolean } {
    const p = { ...player };
    const duct = STAGE_THREE.duct;
    let reaction = cloneReaction(input);
    if (reaction.kind === 'done') {
        reaction.rest += dt;
        if (reaction.rest < duct.gustPeriod) return { reaction, p, knocked: false };
        // Age 10 keeps the first sneeze's junk settled where it landed.
        reaction = { kind: 'reacting', age: 10, shots: reaction.shots, bursts: [{ kind: 'gust', age: reaction.rest - duct.gustPeriod }] };
    }
    if (reaction.kind !== 'reacting') return { reaction, p, knocked: false };
    let knocked = false;
    reaction.age += dt;
    for (const burst of reaction.bursts) {
        const timing = ductTimings(burst.kind);
        const windAt = timing.inhale + timing.twitch;
        const before = burst.age;
        burst.age += dt;
        if (before < windAt && burst.age >= windAt
            && p.x >= duct.x - 260 && p.x <= duct.x + 30 && Math.abs(p.y - duct.y) < 180) {
            const strong = burst.kind !== 'repeat';
            const speed = burst.kind === 'first' ? duct.firstKnockback : burst.kind === 'gust' ? duct.gustKnockback : duct.repeatKnockback;
            p.vx = Math.max(-315, Math.min(-speed, p.vx - speed * .5));
            p.vy -= strong ? 70 : 25;
            p.w -= strong ? .3 : .1;
            knocked = true;
        }
    }
    reaction.bursts = reaction.bursts.filter(burst => {
        const timing = ductTimings(burst.kind);
        return burst.age < timing.inhale + timing.twitch + timing.sneeze;
    });
    if (!reaction.bursts.length) return { reaction: { kind: 'done', shots: reaction.shots, rest: 0 }, p, knocked };
    return { reaction, p, knocked };
}
