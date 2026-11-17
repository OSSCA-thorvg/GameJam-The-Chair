import { impactReplay, impactStep } from './decide';
import { setActivity } from '../../state';

import type { CoreState } from '../../state';
import type { GameEvent, Point } from '../../types';
export function applyHeadHit(
    s: CoreState,
    out: GameEvent[],
    point: Point,
): void {
    if (s.mode !== 'play') {
        return;
    }
    s.deaths++;
    s.keys = [];
    setActivity(s, {
        mode: 'impact',
        lossReason: 'head',
        impact: impactReplay(s.history, s.p, point),
    });
    out.push({ type: 'cue', id: 'head-hit' });
    out.push({ type: 'cue', id: 'head-comment' });
}

export function applyImpact(s: CoreState, out: GameEvent[], dt: number): void {
    if (s.mode !== 'impact') {
        return;
    }
    const r = impactStep(s.impact, dt);
    setActivity(s, {
        mode: r.done ? 'dead' : 'impact',
        lossReason: 'head',
        impact: r.impact,
    });
    if (r.pose) {
        s.p = r.pose;
    }
    if (r.done) {
        out.push({ type: 'cue', id: 'head-game-over' });
    }
}
