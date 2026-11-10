import type { GameCore } from '../core';
import { STAGE_THREE } from '../stage3';
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
        s.keys.clear();
        s.jumpQ = 0;
    }
    return true;
}

export function rooftopStep(s: GameCore, dt: number) {
    const p = s.p;
    if (!s.hasExtinguisher && Math.abs(p.x - STAGE_THREE.pickup.x) < 55 && Math.abs(p.y - STAGE_THREE.pickup.y) < 75) {
        s.hasExtinguisher = true;
        s.checkpoint = 1;
        s.events.push({ type: 'cue', id: 'extinguisher-pickup' });
        s.events.push({ type: 'cue', id: 'checkpoint' });
    }
    // Save only on a real landing: flying past a flag must not skip the course.
    if (s.hasExtinguisher && s.ground) {
        for (let i = s.checkpoint + 1; i < STAGE_THREE.checkpoints.length; i++) {
            const mark = STAGE_THREE.checkpoints[i];
            if (Math.abs(p.x - mark.x) < 90 && Math.abs(p.y - mark.y) < 35) {
                s.checkpoint = i;
                s.focus = 100;
                s.focusClock = 0;
                s.events.push({ type: 'cue', id: 'checkpoint' });
            }
        }
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
        s.keys.clear();
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
