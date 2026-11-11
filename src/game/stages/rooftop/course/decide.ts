import type { Player } from '../../../types';
import { STAGE_THREE, ductTimings, type DuctBurst } from '../data';
import { STAGE_FOUR } from '../../sky/data';

export type RooftopEntrance = { kind: 'opening'; age: number } | { kind: 'ready' };
export type FirstFlight = { kind: 'course'; verticalShots: number; lastShotAt: number } | { kind: 'flight'; age: number };
export type DuctReaction = { kind: 'idle' } | { kind: 'reacting'; age: number; shots: number; bursts: DuctBurst[] } | { kind: 'done'; shots: number };

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

// After collisions on the rooftop: the duct's sneeze, the extinguisher pickup, the ceiling and the launch pad.
export function rooftopStep(input: RooftopInput, dt: number): RooftopResult {
    const duct = ductReactionStep(input.ductReaction, input.p, dt);
    const p = duct.p;
    const ground = duct.knocked ? false : input.ground;
    const pickup = !input.hasExtinguisher && Math.abs(p.x - STAGE_THREE.pickup.x) < 55 && Math.abs(p.y - STAGE_THREE.pickup.y) < 75;
    if (p.y < STAGE_THREE.ceiling) {
        p.y = STAGE_THREE.ceiling;
        p.vy = Math.max(0, p.vy);
    }
    let firstFlight = input.firstFlight.kind === 'course' ? { ...input.firstFlight } : { ...input.firstFlight };
    const launch = STAGE_THREE.launch;
    if (firstFlight.kind === 'course' && (p.x < launch.left || p.x > launch.right || input.time - firstFlight.lastShotAt > launch.shotWindow)) {
        firstFlight = { ...firstFlight, verticalShots: 0 };
    }
    return { p, ground, firstFlight, ductReaction: duct.reaction, pickup };
}

// Three straight-down sprays in a row on the launch pad send the chair up into the sky.
export function launchShot(firstFlight: Readonly<FirstFlight>, p: Readonly<Player>, time: number, direction: number): { firstFlight: FirstFlight; p: Player; takeoff: boolean } {
    const next = { ...p };
    if (firstFlight.kind !== 'course') return { firstFlight: { ...firstFlight }, p: next, takeoff: false };
    const launch = STAGE_THREE.launch;
    if (direction !== 0 || p.y > -144 || p.x < launch.left || p.x > launch.right) {
        return { firstFlight: { ...firstFlight, verticalShots: 0 }, p: next, takeoff: false };
    }
    const consecutive = time - firstFlight.lastShotAt <= launch.shotWindow;
    const verticalShots = consecutive ? firstFlight.verticalShots + 1 : 1;
    next.vx = 0;
    if (verticalShots !== 3) return { firstFlight: { kind: 'course', verticalShots, lastShotAt: time }, p: next, takeoff: false };
    next.vy = Math.min(next.vy, -320);
    next.w = 0;
    return { firstFlight: { kind: 'flight', age: 0 }, p: next, takeoff: true };
}

// The scripted climb from the launch pad up to the sky stage.
export function flightStep(flight: { kind: 'flight'; age: number }, p: Readonly<Player>, dt: number): { flight: FirstFlight; p: Player; arrived: boolean } {
    const next = { ...p, vx: 0 };
    const remaining = Math.max(0, next.y - STAGE_FOUR.arrivalY);
    const targetSpeed = -Math.min(300, Math.max(35, remaining * 1.5));
    next.vy += (targetSpeed - next.vy) * (1 - Math.exp(-2.5 * dt));
    next.y += next.vy * dt;
    next.a += (0 - next.a) * dt * 5;
    return { flight: { kind: 'flight', age: flight.age + dt }, p: next, arrived: next.y <= STAGE_FOUR.arrivalY };
}

// Spraying into the front of the rooftop duct makes it sneeze. Repeat sprays queue weaker sneezes.
export function ductSprayed(reaction: Readonly<DuctReaction>, p: Readonly<Player>): DuctReaction {
    const duct = STAGE_THREE.duct;
    const dx = duct.x - p.x;
    if (dx < -30 || dx > duct.frontReach || Math.abs(p.y - duct.y) > duct.frontHeight) return cloneReaction(reaction);
    if (reaction.kind === 'idle') return { kind: 'reacting', age: 0, shots: 1, bursts: [{ kind: 'first', age: 0 }] };
    if (reaction.kind === 'done') return { kind: 'reacting', age: 10, shots: reaction.shots + 1, bursts: [{ kind: 'repeat', age: 0 }] };
    const next = cloneReaction(reaction) as Extract<DuctReaction, { kind: 'reacting' }>;
    next.shots++;
    next.bursts.push({ kind: 'repeat', age: 0 });
    return next;
}

function ductReactionStep(input: Readonly<DuctReaction>, player: Readonly<Player>, dt: number): { reaction: DuctReaction; p: Player; knocked: boolean } {
    const p = { ...player };
    const reaction = cloneReaction(input);
    if (reaction.kind !== 'reacting') return { reaction, p, knocked: false };
    const duct = STAGE_THREE.duct;
    let knocked = false;
    reaction.age += dt;
    for (const burst of reaction.bursts) {
        const timing = ductTimings(burst.kind);
        const windAt = timing.inhale + timing.twitch;
        const before = burst.age;
        burst.age += dt;
        if (before < windAt && burst.age >= windAt
            && p.x >= duct.x - 260 && p.x <= duct.x + 30 && Math.abs(p.y - duct.y) < 180) {
            const first = burst.kind === 'first';
            const speed = first ? duct.firstKnockback : duct.repeatKnockback;
            p.vx = Math.max(-315, Math.min(-speed, p.vx - speed * .5));
            p.vy -= first ? 70 : 25;
            p.w -= first ? .3 : .1;
            knocked = true;
        }
    }
    reaction.bursts = reaction.bursts.filter(burst => {
        const timing = ductTimings(burst.kind);
        return burst.age < timing.inhale + timing.twitch + timing.sneeze;
    });
    if (!reaction.bursts.length) return { reaction: { kind: 'done', shots: reaction.shots }, p, knocked };
    return { reaction, p, knocked };
}
