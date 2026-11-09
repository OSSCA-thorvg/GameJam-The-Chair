import { LEVEL, RULES } from '../level';
import type { GameCore } from '../core';
import { focusHit } from './focus';

export function shoot(s: GameCore) {
    const F = LEVEL.floor;
    const dir = s.copier.dir;
    for (let i = 0; i < 4; i++) {
        s.papers.push({
            x: s.copier.x + dir * 48,
            y: F - 90 - i * 4,
            vx: dir * (200 + i * 24),
            vy: -60 - i * 27,
            a: i * .8,
            w: dir * (3 + i),
            life: 5,
            hit: false,
            landed: false,
            volley: s.volley,
            safe: s.volley === 1 && s.bursts === 0,
        });
    }
    s.bursts++;
    s.events.push({ type: 'volley' });
    if (s.bursts === 1) {
        s.events.push({ type: 'cue', id: 'first-volley' });
    }
}

export function particlesStep(s: GameCore, dt: number) {
    const F = LEVEL.floor;
    for (const z of s.papers) {
        z.life -= dt;
        z.x += z.vx * dt;
        z.y += z.vy * dt;
        z.vx *= Math.exp(-.8 * dt);
        z.vy += 210 * dt;
        z.a += z.w * dt;
        const pit = z.x > s.bin.a && z.x < s.bin.b;
        if (z.y > F - 4 && !pit) {
            z.y = F - 4;
            z.vy = 0;
            z.vx *= Math.exp(-4 * dt);
            z.w *= .9;
            z.landed = true;
        }
        if (!z.safe && !z.hit && !z.landed && !s.inBin && Math.hypot(z.x - s.p.x, z.y - (s.p.y - 50)) < 48) {
            z.hit = true;
            s.paperHits++;
            focusHit(s, 'paper', z.volley, RULES.copierFocusDamage);
            if (s.mode !== 'play') return;
            s.p.vx *= .88;
            s.p.w += z.vx * .0009;
            s.paperPenaltyRemaining = RULES.paperPenalty;
            s.events.push({ type: 'cue', id: 'paper-hit' });
        }
    }
    s.papers = s.papers.filter(z => z.life > 0).slice(-60);
    s.events.push({ type: 'particles-step', dt });
}
