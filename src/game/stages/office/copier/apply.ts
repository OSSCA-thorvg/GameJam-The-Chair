// Writes the decisions from ./decide into game state. The only place this system changes state.
import { RULES } from '../../../level';
import type { GameState } from '../../../state';
import type { GameEvent, Paper } from '../../../types';
import { applyFocusHit } from '../../../systems/focus/apply';
import { paperShot, trimPapers, type CopierResult, type PaperHit } from './decide';
export function applyCopier(s: GameState, out: GameEvent[], result: CopierResult) {
    s.copier = result.copier;
    s.volley = result.volley;
    if (!result.fire) return;
    s.papers.push(...paperShot(s.copier, s.volley, s.bursts));
    s.bursts++;
    out.push({ type: 'volley' });
    if (s.bursts === 1) out.push({ type: 'cue', id: 'first-volley' });
}

export function applyPapers(s: GameState, out: GameEvent[], result: { papers: Paper[]; hits: readonly PaperHit[] }, dt: number) {
    for (const hit of result.hits) {
        s.paperHits++;
        if (!applyFocusHit(s, out, hit.focus)) {
            // Play stops at this sheet: later sheets keep their previous positions this tick.
            s.papers = [...result.papers.slice(0, hit.index + 1), ...s.papers.slice(hit.index + 1)];
            return false;
        }
        s.p.vx *= .88;
        s.p.w += hit.vx * .0009;
        s.paperPenaltyRemaining = RULES.paperPenalty;
        out.push({ type: 'cue', id: 'paper-hit' });
    }
    s.papers = trimPapers(result.papers);
    out.push({ type: 'particles-step', dt });
    return true;
}
