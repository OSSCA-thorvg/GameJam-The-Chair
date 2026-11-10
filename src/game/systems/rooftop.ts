import type { GameCore } from '../core';
import type { GameEvent } from '../types';
import { STAGE_THREE, ductTimings } from '../stage3';
import { STAGE_FOUR } from '../stage4';

export function rooftopEntranceStep(s: GameCore, dt: number) {
    if (s.rooftopEntrance.kind !== 'opening') return false;
    const entrance = STAGE_THREE.entrance;
    s.rooftopEntrance.age = Math.min(entrance.duration, s.rooftopEntrance.age + dt);
    const progress = Math.max(0, Math.min(1, (s.rooftopEntrance.age - entrance.emergeAt) / (entrance.emergeEnd - entrance.emergeAt)));
    const ease = progress * progress * (3 - 2 * progress);
    s.p.x = entrance.fromX + (entrance.toX - entrance.fromX) * ease;
    s.p.y = STAGE_THREE.checkpoints[0].y;
    s.p.vx = (entrance.toX - entrance.fromX) * 6 * progress * (1 - progress) / (entrance.emergeEnd - entrance.emergeAt);
    s.p.vy = s.p.a = s.p.w = 0;
    s.ground = true;
    if (s.rooftopEntrance.age >= entrance.duration) {
        s.rooftopEntrance = { kind: 'ready' };
        s.p.vx = 0;
        s.keys = [];
        s.jumpQ = 0;
    }
    return true;
}

export function rooftopStep(s: GameCore, out: GameEvent[], dt: number) {
    const p = s.p;
    ductReactionStep(s, dt);
    if (!s.hasExtinguisher && Math.abs(p.x - STAGE_THREE.pickup.x) < 55 && Math.abs(p.y - STAGE_THREE.pickup.y) < 75) {
        s.hasExtinguisher = true;
        s.checkpoint = 1;
        out.push({ type: 'cue', id: 'extinguisher-pickup' });
        out.push({ type: 'cue', id: 'checkpoint' });
    }
    if (p.y < STAGE_THREE.ceiling) {
        p.y = STAGE_THREE.ceiling;
        p.vy = Math.max(0, p.vy);
    }
    if (s.firstFlight.kind === 'course' && (p.x < STAGE_THREE.launch.left || p.x > STAGE_THREE.launch.right || s.time - s.firstFlight.lastShotAt > STAGE_THREE.launch.shotWindow)) {
        s.firstFlight.verticalShots = 0;
    }
}

export function rooftopLaunchShot(s: GameCore, direction: number) {
    if (s.stage !== 3 || s.firstFlight.kind !== 'course') return;
    const launch = STAGE_THREE.launch;
    if (direction !== 0 || s.p.y > -144 || s.p.x < launch.left || s.p.x > launch.right) {
        s.firstFlight.verticalShots = 0;
        return;
    }
    const consecutive = s.time - s.firstFlight.lastShotAt <= launch.shotWindow;
    s.firstFlight.verticalShots = consecutive ? s.firstFlight.verticalShots + 1 : 1;
    s.firstFlight.lastShotAt = s.time;
    s.p.vx = 0;
    if (s.firstFlight.verticalShots === 3) {
        s.firstFlight = { kind: 'flight', age: 0 };
        s.p.vy = Math.min(s.p.vy, -320);
        s.p.w = 0;
        s.keys = [];
        s.jumpQ = 0;
    }
}

export function firstFlightStep(s: GameCore, dt: number): false | 'flight' | 'arrived' {
    if (s.firstFlight.kind !== 'flight') return false;
    s.firstFlight.age += dt;
    s.p.vx = 0;
    const remaining = Math.max(0, s.p.y - STAGE_FOUR.arrivalY);
    const targetSpeed = -Math.min(300, Math.max(35, remaining * 1.5));
    s.p.vy += (targetSpeed - s.p.vy) * (1 - Math.exp(-2.5 * dt));
    s.sprayBurst = .24;
    s.sprayDir = { x: 0, y: 1 };
    s.p.y += s.p.vy * dt;
    s.p.a += (0 - s.p.a) * dt * 5;
    return s.p.y <= STAGE_FOUR.arrivalY ? 'arrived' : 'flight';
}

export function ductSpray(s: GameCore) {
    if (s.stage !== 3) return;
    const duct = STAGE_THREE.duct;
    const dx = duct.x - s.p.x;
    if (dx < -30 || dx > duct.frontReach || Math.abs(s.p.y - duct.y) > duct.frontHeight) return;
    if (s.ductReaction.kind === 'idle') {
        s.ductReaction = { kind: 'reacting', age: 0, shots: 1, bursts: [{ kind: 'first', age: 0 }] };
    } else if (s.ductReaction.kind === 'done') {
        s.ductReaction = { kind: 'reacting', age: 10, shots: s.ductReaction.shots + 1, bursts: [{ kind: 'repeat', age: 0 }] };
    } else {
        s.ductReaction.shots++;
        s.ductReaction.bursts.push({ kind: 'repeat', age: 0 });
    }
}

function ductReactionStep(s: GameCore, dt: number) {
    const reaction = s.ductReaction;
    if (reaction.kind !== 'reacting') return;
    const duct = STAGE_THREE.duct;
    reaction.age += dt;
    for (const burst of reaction.bursts) {
        const timing = ductTimings(burst.kind);
        const windAt = timing.inhale + timing.twitch;
        const before = burst.age;
        burst.age += dt;
        if (before < windAt && burst.age >= windAt
            && s.p.x >= duct.x - 260 && s.p.x <= duct.x + 30 && Math.abs(s.p.y - duct.y) < 180) {
            const first = burst.kind === 'first';
            const speed = first ? duct.firstKnockback : duct.repeatKnockback;
            s.p.vx = Math.max(-315, Math.min(-speed, s.p.vx - speed * .5));
            s.p.vy -= first ? 70 : 25;
            s.p.w -= first ? .3 : .1;
            s.ground = false;
        }
    }
    reaction.bursts = reaction.bursts.filter(burst => {
        const timing = ductTimings(burst.kind);
        return burst.age < timing.inhale + timing.twitch + timing.sneeze;
    });
    if (!reaction.bursts.length) s.ductReaction = { kind: 'done', shots: reaction.shots };
}
