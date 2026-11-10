import type { GameCore } from '../core';
import { STAGE_FOUR, skyPlatforms, skySurface, skyWind } from '../stage4';

export function skyStep(s: GameCore, dt: number) {
    const sky = s.sky, p = s.p;
    const direction = (s.keys.has('right') ? 1 : 0) - (s.keys.has('left') ? 1 : 0);
    sky.age += dt;
    s.jumpQ = Math.max(0, s.jumpQ - dt);
    if (sky.phase === 'reveal' || sky.phase === 'depth') {
        s.sprayBurst = .24;
        p.vx *= Math.exp(-4 * dt);
        p.vy = 0;
        p.y = -2338 + Math.sin(s.time) * 6;
        p.a *= Math.exp(-4 * dt);
        s.ground = false;
        if (sky.phase === 'reveal' && sky.age > 5) { sky.phase = 'depth'; sky.age = 0; }
        if (sky.phase === 'depth') {
            const depthDir = (s.keys.has('forward') ? 1 : 0) - (s.keys.has('back') ? 1 : 0);
            const before = sky.depth;
            sky.depth = Math.max(-1, Math.min(1, sky.depth + depthDir * dt * .65));
            sky.depthTravel += Math.abs(sky.depth - before);
            if (sky.depthTravel > .65) { s.mode = 'won'; s.keys.clear(); s.events.push({ type: 'cue', id: 'stage-clear' }); }
        }
        return;
    }
    if (sky.phase === 'arrival') {
        p.vx += direction * 220 * dt;
        p.vx *= Math.exp(-1.4 * dt);
        p.x += p.vx * dt;
        const hoverY = STAGE_FOUR.spawn.y + Math.sin(s.time * 1.3) * 6;
        p.vy += ((hoverY - p.y) * 2 - p.vy) * (1 - Math.exp(-2.5 * dt));
        p.y += p.vy * dt;
        s.sprayBurst = .24;
        s.sprayDir = { x: -direction * .33, y: 1 };
        s.ground = false;
        if (p.x > 2640) { sky.phase = 'course'; sky.age = 0; }
    } else {
        const before = skyPlatforms(sky, s.time - dt);
        const oldStanding = before.find(platform => platform.id === sky.standing);
        sky.lift = Math.min(1, sky.lift + (s.checkpoint > 0 ? dt * .45 : 0));
        const wind = skyWind(s.time);
        const targetTilt = -.12 - (1 - wind) * 1.12;
        // Weight keeps the sign down long enough to roll along its face.
        sky.signTilt += ((sky.standing === 'wind-sign' ? -.12 : targetTilt) - sky.signTilt) * Math.min(1, dt * 2);
        if (sky.standing === 'drawer-desk') {
            sky.drawer = Math.min(1, sky.drawer + dt * 1.5);
            const lean = (p.x - 4205) / 135;
            sky.deskTilt += (lean * .16 - sky.deskTilt) * Math.min(1, dt * 3);
        } else sky.deskTilt *= Math.exp(-dt);
        const platforms = skyPlatforms(sky, s.time);
        const standing = platforms.find(platform => platform.id === sky.standing);
        if (s.ground && oldStanding && standing) p.y += skySurface(standing, p.x) - skySurface(oldStanding, p.x);
        s.coyote = s.ground ? .12 : Math.max(0, s.coyote - dt);
        if (s.jumpQ > 0 && s.coyote > 0) { p.vy = -330; s.ground = false; s.coyote = 0; s.jumpQ = 0; }
        const oldFoot = p.y + 28;
        const oldX = p.x;
        p.vx += (direction * (s.ground ? 390 : 250) + (p.x > 3380 && p.x < 3890 ? wind * 65 : 0)) * dt;
        if (s.ground && standing) p.vx += Math.sin(standing.angle) * 190 * dt;
        p.vx *= Math.exp(-(s.ground ? 1.8 : .6) * dt);
        p.vx = Math.max(-260, Math.min(260, p.vx));
        p.vy = Math.min(580, p.vy + (p.x > 3970 ? 410 : 650) * dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        s.ground = false;
        sky.standing = null;
        if (p.vy >= 0) for (const platform of platforms) {
            if (Math.abs(platform.angle) > .55 || p.x < platform.x + 8 || p.x > platform.x + platform.width - 8) continue;
            const surface = skySurface(platform, p.x);
            const old = before.find(item => item.id === platform.id) ?? platform;
            if (oldFoot > skySurface(old, oldX) + 9 || p.y + 28 < surface) continue;
            p.y = surface - 28; p.vy = 0; s.ground = true; sky.standing = platform.id;
            const checkpoint = platform.id === 'arrival-roof' ? 1 : platform.id === 'rest' ? 2 : platform.id === 'upper-rest' ? 3 : 0;
            if (checkpoint > s.checkpoint) { s.checkpoint = checkpoint; s.events.push({ type: 'cue', id: 'checkpoint' }); }
            if (platform.id === 'finish') { sky.phase = 'reveal'; sky.age = 0; s.ground = false; }
            break;
        }
        const safe = STAGE_FOUR.checkpoints[s.checkpoint];
        if (p.y > safe.y + 650) {
            Object.assign(p, safe, { vx: 0, vy: 0, a: 0, w: 0 });
            s.deaths++; s.ground = false; sky.standing = null;
            if (s.checkpoint === 0) sky.phase = 'arrival';
            s.sprayBurst = .24;
        }
    }
    p.x = Math.max(2250, Math.min(s.LEN - 80, p.x));
    const targetAngle = s.ground ? skyPlatforms(sky, s.time).find(item => item.id === sky.standing)?.angle ?? 0 : direction * .08;
    p.a += (targetAngle - p.a) * (1 - Math.exp(-5 * dt));
    p.w = 0;
    s.actualSpeed = Math.abs(p.vx);
}
