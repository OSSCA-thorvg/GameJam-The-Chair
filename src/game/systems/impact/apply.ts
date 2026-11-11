// Writes the decisions from ./decide into game state. The only place this system changes state.
import type { GameState } from '../../state';
import type { GameEvent, Point } from '../../types';
import { impactReplay, impactStep } from './decide';
export function applyHeadHit(s: GameState, out: GameEvent[], point: Point) {
    if (s.mode !== 'play' || s.inBin) return;
    s.deaths++;
    s.lossReason = 'head';
    s.keys = [];
    s.impact = impactReplay(s.history, s.p, point);
    s.mode = 'impact';
    out.push({ type: 'cue', id: 'head-hit' });
    out.push({ type: 'cue', id: 'head-comment' });
}

export function applyImpact(s: GameState, out: GameEvent[], dt: number) {
    if (!s.impact) return;
    const r = impactStep(s.impact, dt);
    s.impact = r.impact;
    if (r.pose) s.p = r.pose;
    if (r.done) {
        s.mode = 'dead';
        out.push({ type: 'cue', id: 'head-game-over' });
    }
}
