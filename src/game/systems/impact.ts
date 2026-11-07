import { snapshot, type GameCore } from '../core';
import type { Point } from '../types';

export function fail(s: GameCore, point: Point) {
    if (s.mode !== 'play' || s.inBin) return;
    s.deaths++;
    s.lossReason = 'head';
    s.keys.clear();
    s.impact = { frames: s.history.slice(-42).concat(snapshot(s)), elapsed: 0, point };
    s.mode = 'impact';
    s.events.push({ type: 'cue', id: 'head-hit' });
    s.events.push({ type: 'cue', id: 'head-comment' });
}

export function impactStep(s: GameCore, dt: number) {
    if (!s.impact) return;
    s.impact.elapsed += dt;
    const n = s.impact.frames.length - 1;
    const u = Math.min(n, s.impact.elapsed * .25 * 120);
    const i = Math.min(n - 1, Math.floor(u));
    const f = u - i;
    const a = s.impact.frames[Math.max(0, i)];
    const b = s.impact.frames[Math.max(0, i + 1)];
    if (a && b) {
        s.p = { ...a.p };
        for (const k of ['x', 'y', 'vx', 'vy', 'a', 'w'] as const) {
            s.p[k] = a.p[k] + (b.p[k] - a.p[k]) * f;
        }
    }
    if (s.impact.elapsed > n / 120 / .25 + .35) {
        s.mode = 'dead';
        s.events.push({ type: 'cue', id: 'head-game-over' });
    }
}
