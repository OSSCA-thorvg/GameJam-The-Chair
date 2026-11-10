import { FOCUS_DAMAGE, LEVEL } from '../level';
import type { GameCore } from '../core';
import type { GameEvent } from '../types';
import { focusHit } from './focus';
import { random } from '../rng';

export type GeyserPhase = 'rest' | 'warning' | 'burst';
export function geyserPhase(geyser: { period: number; offset: number }, t: number): { kind: GeyserPhase; age: number; remaining: number } {
    const p = ((t + geyser.offset) % geyser.period + geyser.period) % geyser.period;
    if (p < 2.3) return { kind: 'rest', age: p, remaining: 2.3 - p };
    if (p < 3.1) return { kind: 'warning', age: p - 2.3, remaining: 3.1 - p };
    return { kind: 'burst', age: p - 3.1, remaining: geyser.period - p };
}

export function geyserStep(s: GameCore, out: GameEvent[], _dt: number) {
    const p = s.p;
    for (let i = 0; i < LEVEL.geysers.length; i++) {
        const g = LEVEL.geysers[i];
        const phase = geyserPhase(g, s.time);
        if (phase.kind !== 'burst') continue;
        if (Math.abs(p.x - g.x) > 34) continue;
        if (p.y < LEVEL.floor - 160) continue;
        p.vy = -520;
        p.vx += (Math.sign(p.x - g.x) || 1) * 90;
        p.w += (random(s.rng, 'physics') - .5) * 6;
        focusHit(s, out, 'paper', 1000 + i * 100 + Math.floor(s.time / g.period), FOCUS_DAMAGE.paper);
        if (s.mode !== 'play') return;
        out.push({ type: 'cue', id: 'light-hit' });
    }
}
