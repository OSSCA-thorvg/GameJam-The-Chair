import { FOCUS_DAMAGE, LEVEL } from '../../../level';
import type { Point } from '../../../types';
import type { FocusHit } from '../../../systems/focus/decide';
import { nextRandom } from '../../../rng';

export type GeyserPhase = 'rest' | 'warning' | 'burst';
export function geyserPhase(geyser: { period: number; offset: number }, t: number): { kind: GeyserPhase; age: number; remaining: number } {
    const p = ((t + geyser.offset) % geyser.period + geyser.period) % geyser.period;
    if (p < 2.3) return { kind: 'rest', age: p, remaining: 2.3 - p };
    if (p < 3.1) return { kind: 'warning', age: p - 2.3, remaining: 3.1 - p };
    return { kind: 'burst', age: p - 3.1, remaining: geyser.period - p };
}

export type GeyserHit = { push: number; spin: number; rng: number; focus: FocusHit };

// Which geysers launch the chair this tick. Each hit carries the physics stream state after its spin draw.
export function geyserHits(p: Readonly<Point>, time: number, rng: number): GeyserHit[] {
    const hits: GeyserHit[] = [];
    for (let i = 0; i < LEVEL.geysers.length; i++) {
        const g = LEVEL.geysers[i];
        if (geyserPhase(g, time).kind !== 'burst') continue;
        if (Math.abs(p.x - g.x) > 34) continue;
        if (p.y < LEVEL.floor - 160) continue;
        const draw = nextRandom(rng);
        rng = draw.state;
        hits.push({
            push: (Math.sign(p.x - g.x) || 1) * 90,
            spin: (draw.value - .5) * 6,
            rng,
            focus: { kind: 'paper', id: 1000 + i * 100 + Math.floor(time / g.period), damage: FOCUS_DAMAGE.paper },
        });
    }
    return hits;
}
