import type { Player, Point, Snapshot } from '../../types';

export type Impact = { frames: Snapshot[]; elapsed: number; point: Point };

const REWIND_SPEED = 0.25;
const HOLD_AFTER = 0.35;

export function impactReplay(
    history: ReadonlyArray<Readonly<Snapshot>>,
    p: Readonly<Player>,
    point: Readonly<Point>,
): Impact {
    return {
        frames: history
            .slice(-42)
            .map((frame) => ({ p: { ...frame.p } }))
            .concat({ p: { ...p } }),
        elapsed: 0,
        point: { ...point },
    };
}

export function impactStep(
    impact: Readonly<Impact>,
    dt: number,
): { impact: Impact; pose: Player | null; done: boolean } {
    const elapsed = impact.elapsed + dt;
    const frames = impact.frames;
    const n = frames.length - 1;
    const u = Math.min(n, elapsed * REWIND_SPEED * 120);
    const i = Math.min(n - 1, Math.floor(u));
    const f = u - i;
    const a = frames.at(Math.max(0, i));
    const b = frames.at(Math.max(0, i + 1));
    let pose: Player | null = null;
    if (a && b) {
        pose = { ...a.p };
        for (const k of ['x', 'y', 'vx', 'vy', 'a', 'w'] as const) {
            pose[k] = a.p[k] + (b.p[k] - a.p[k]) * f;
        }
    }
    return {
        impact: { ...impact, elapsed },
        pose,
        done: elapsed > n / 120 / REWIND_SPEED + HOLD_AFTER,
    };
}
