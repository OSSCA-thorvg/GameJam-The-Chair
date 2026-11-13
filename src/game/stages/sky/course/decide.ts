import { STAGE_FOUR, skyHazards, skyHeadwind, skyPlatforms, skySurface, skyWind, type SkyHazardKind, type SkyState } from '../data';
import type { Player, Point } from '../../../types';
import * as Det from '../../../math';

export type SkyInput = {
    sky: Readonly<SkyState>;
    p: Readonly<Player>;
    ground: boolean;
    coyote: number;
    jumpQ: number;
    checkpoint: number;
    time: number;
    direction: number;  // -1, 0, 1 left/right
    length: number;
    sprayBurst: number;
    sprayDir: Readonly<Point>;
};
export type SkyResult = Omit<SkyInput, 'time' | 'direction' | 'length' | 'sky' | 'p' | 'sprayDir'> & {
    sky: SkyState;
    p: Player;
    sprayDir: Point;
    speed: number | null;  // null leaves actualSpeed unchanged
    reached: boolean;      // a new flag was saved
    fell: boolean;         // dropped below the last flag and was put back
    won: boolean;
    hit: SkyHazardKind | null;  // a paper bundle or bird knocked the chair back this tick
};

// Stage 4 above the clouds: hover in, hop across growing windows, a gusting sign and floating desks,
// then an automatic side-to-back camera turn and final hold. Works on its own copies.
export function skyStep(input: SkyInput, dt: number): SkyResult {
    const sky = { ...input.sky };
    const p = { ...input.p };
    let { ground, coyote, jumpQ, checkpoint, sprayBurst } = input;
    let sprayDir = { ...input.sprayDir };
    let reached = false, fell = false, won = false;
    let hit: SkyHazardKind | null = null;
    const { direction, time } = input;
    const result = (speed: number | null): SkyResult => ({ sky, p, ground, coyote, jumpQ, checkpoint, sprayBurst, sprayDir, speed, reached, fell, won, hit });
    sky.age += dt;
    jumpQ = Math.max(0, jumpQ - dt);
    if (sky.phase === 'reveal' || sky.phase === 'depth') {
        sprayBurst = .24;
        p.vx *= Det.exp(-4 * dt);
        p.vy = 0;
        p.y = -2338 + Det.sin(time) * 6;
        p.a *= Det.exp(-4 * dt);
        ground = false;
        p.x += (5045 - p.x) * (1 - Det.exp(-4 * dt));
        sprayDir = { x: 0, y: 1 };
        coyote = jumpQ = 0;
        if (sky.phase === 'reveal' && sky.age >= STAGE_FOUR.reveal.settle + STAGE_FOUR.reveal.turn) {
            sky.phase = 'depth';
            sky.age = 0;
        }
        if (sky.phase === 'depth' && sky.age >= STAGE_FOUR.reveal.hold) won = true;
        return result(0);
    }
    if (sky.phase === 'arrival') {
        p.vx += direction * 220 * dt;
        p.vx *= Det.exp(-1.4 * dt);
        p.x += p.vx * dt;
        const hoverY = STAGE_FOUR.spawn.y + Det.sin(time * 1.3) * 6;
        p.vy += ((hoverY - p.y) * 2 - p.vy) * (1 - Det.exp(-2.5 * dt));
        p.y += p.vy * dt;
        sprayBurst = .24;
        sprayDir = { x: -direction * .33, y: 1 };
        ground = false;
        if (p.x > 2640) { sky.phase = 'course'; sky.age = 0; }
    } else {
        const before = skyPlatforms(sky, time - dt);
        const oldStanding = before.find(platform => platform.id === sky.standing);
        // The windows grow once the chair has touched the arrival roof, and stay grown after a fall.
        if (sky.lift > 0 || sky.standing === 'arrival-roof' || checkpoint > 0) sky.lift = Math.min(1, sky.lift + dt * .45);
        sky.knock = Math.max(0, sky.knock - dt);
        if (sky.knock === 0) sky.knockKind = null;
        const wind = skyWind(time);
        // The sign blows flat only while a gust is on it, folding back down in the calm.
        const targetTilt = -.12 - (1 - wind) * 1.12;
        sky.signTilt += ((sky.standing === 'wind-sign' ? -.12 : targetTilt) - sky.signTilt) * Math.min(1, dt * 2);
        if (sky.standing === 'drawer-desk') {
            sky.drawer = Math.min(1, sky.drawer + dt * 1.5);
            const lean = (p.x - 4205) / 135;
            sky.deskTilt += (lean * .16 - sky.deskTilt) * Math.min(1, dt * 3);
        } else sky.deskTilt *= Det.exp(-dt);
        const platforms = skyPlatforms(sky, time);
        const standing = platforms.find(platform => platform.id === sky.standing);
        if (ground && oldStanding && standing) {
            // Ride the rocking desk: carried sideways with it and kept on its face.
            const carried = standing.x - oldStanding.x;
            p.y += skySurface(standing, p.x + carried) - skySurface(oldStanding, p.x);
            p.x += carried;
        }
        coyote = ground ? .12 : Math.max(0, coyote - dt);
        if (jumpQ > 0 && coyote > 0) { p.vy = -330; ground = false; coyote = 0; jumpQ = 0; }
        const oldFoot = p.y + 28;
        const oldX = p.x;
        const headwind = skyHeadwind(time) * (ground ? STAGE_FOUR.wind.ground : 1);
        p.vx += (direction * (ground ? 390 : 250) - headwind) * dt;
        if (ground && standing) p.vx += Det.sin(standing.angle) * STAGE_FOUR.rock.slide * dt;
        p.vx *= Det.exp(-(ground ? 1.8 : .6) * dt);
        p.vx = Math.max(-300, Math.min(260, p.vx));
        p.vy = Math.min(580, p.vy + (p.x > 3970 ? 410 : 650) * dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (sky.knock === 0) {
            const body = { x: p.x, y: p.y - 20 };
            const struck = skyHazards(time).find(item => Det.hypot(item.x - body.x, item.y - body.y) < item.r + STAGE_FOUR.knock.reach);
            if (struck) {
                // Papers slap the chair backwards and up; a bird clips it back and down.
                hit = struck.kind;
                sky.knock = STAGE_FOUR.knock.cooldown;
                sky.knockKind = struck.kind;
                p.vx = Math.min(p.vx, 0) - (struck.kind === 'paper' ? 210 : 240);
                p.vy = struck.kind === 'paper' ? Math.min(p.vy, -150) : Math.max(p.vy, 0) + 170;
            }
        }
        ground = false;
        sky.standing = null;
        if (p.vy >= 0) for (const platform of platforms) {
            if (Math.abs(platform.angle) > .55 || p.x < platform.x + 8 || p.x > platform.x + platform.width - 8) continue;
            const surface = skySurface(platform, p.x);
            const old = before.find(item => item.id === platform.id) ?? platform;
            if (oldFoot > skySurface(old, oldX) + 9 || p.y + 28 < surface) continue;
            p.y = surface - 28; p.vy = 0; ground = true; sky.standing = platform.id;
            if (platform.id === 'rest' && checkpoint < 1) { checkpoint = 1; reached = true; }
            if (platform.id === 'finish') { sky.phase = 'reveal'; sky.age = 0; ground = false; }
            break;
        }
        if (ground) sky.airSprays = 0;
        if (p.y > STAGE_FOUR.fallY) {
            Object.assign(p, STAGE_FOUR.checkpoints[checkpoint], { vx: 0, vy: 0, a: 0, w: 0 });
            fell = true; ground = false; sky.standing = null; sky.airSprays = 0; sky.knock = 0; sky.knockKind = null;
            if (checkpoint === 0) sky.phase = 'arrival';
            sprayBurst = .24;
        }
    }
    p.x = Math.max(2250, Math.min(input.length - 80, p.x));
    const targetAngle = ground ? skyPlatforms(sky, time).find(item => item.id === sky.standing)?.angle ?? 0 : direction * .08;
    p.a += (targetAngle - p.a) * (1 - Det.exp(-5 * dt));
    p.w = 0;
    return result(Math.abs(p.vx));
}
