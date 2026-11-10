import { FOCUS_DAMAGE, LEVEL, RULES } from '../level';
import type { GameCore } from '../core';
import type { GameEvent } from '../types';
import { focusHit } from './focus';

export function shoot(s: GameCore, out: GameEvent[]) {
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
    out.push({ type: 'volley' });
    if (s.bursts === 1) {
        out.push({ type: 'cue', id: 'first-volley' });
    }
}

export function particlesStep(s: GameCore, out: GameEvent[], dt: number) {
    const F = LEVEL.floor;
    for (const z of s.papers) {
        z.life -= dt;
        z.x += z.vx * dt;
        z.y += z.vy * dt;
        z.vx *= Math.exp(-.8 * dt);
        z.vy += 210 * dt;
        z.a += z.w * dt;
        const pit = z.x > LEVEL.bin.a && z.x < LEVEL.bin.b;
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
            focusHit(s, out, 'paper', z.volley, FOCUS_DAMAGE.copier);
            if (s.mode !== 'play') return;
            s.p.vx *= .88;
            s.p.w += z.vx * .0009;
            s.paperPenaltyRemaining = RULES.paperPenalty;
            out.push({ type: 'cue', id: 'paper-hit' });
        }
    }
    s.papers = s.papers.filter(z => z.life > 0).slice(-60);
    out.push({ type: 'particles-step', dt });
}
