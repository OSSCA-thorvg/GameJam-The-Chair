// Writes the decisions from ./decide into game state. The only place this system changes state.
import { RULES } from '../../../level';
import type { GameState } from '../../../state';
import type { GameEvent, Paper } from '../../../types';
import { applyFocusHit } from '../../../systems/focus/apply';
import { paperShot, trimPapers, type CopierResult, type PaperHit } from './decide';
export function applyCopier(s: GameState, out: GameEvent[], result: CopierResult) {
    s.office.copier = result.copier;
    s.office.volley = result.volley;
    if (!result.fire) return;
    s.office.papers.push(...paperShot(s.office.copier, s.office.volley, s.office.bursts));
    s.office.bursts++;
    out.push({ type: 'volley' });
    if (s.office.bursts === 1) out.push({ type: 'cue', id: 'first-volley' });
}

export function applyPapers(s: GameState, out: GameEvent[], result: { papers: Paper[]; hits: readonly PaperHit[] }, dt: number) {
    for (const hit of result.hits) {
        s.office.paperHits++;
        if (!applyFocusHit(s, out, hit.focus)) {
            // Play stops at this sheet: later sheets keep their previous positions this tick.
            s.office.papers = [...result.papers.slice(0, hit.index + 1), ...s.office.papers.slice(hit.index + 1)];
            return false;
        }
        s.p.vx *= .88;
        s.p.w += hit.vx * .0009;
        s.office.paperPenaltyRemaining = RULES.paperPenalty;
        out.push({ type: 'cue', id: 'paper-hit' });
    }
    s.office.papers = trimPapers(result.papers);
    out.push({ type: 'particles-step', dt });
    return true;
}
