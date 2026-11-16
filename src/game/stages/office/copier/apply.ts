import { paperShot, trimPapers, urgentShot } from './decide';
import { RULES } from '../../../level';
import { applyFocusHit } from '../../../systems/focus/apply';

import type { CopierResult, PaperHit, UrgentResult } from './decide';
import type { CoreState } from '../../../state';
import type { GameEvent, Paper } from '../../../types';
export function applyCopier(
    s: CoreState,
    out: GameEvent[],
    result: CopierResult,
): void {
    s.office.copier = result.copier;
    if (!result.fire) {
        return;
    }
    s.office.papers.push(...paperShot(s.office.copier));
    s.office.copier.bursts++;
    out.push({ type: 'volley' });
    if (s.office.copier.bursts === 1) {
        out.push({ type: 'cue', id: 'first-volley' });
    }
}

export function applyUrgentCopier(
    s: CoreState,
    out: GameEvent[],
    result: UrgentResult,
): void {
    s.office.urgent = result.copier;
    if (result.started && result.copier.volley === 1) {
        out.push({ type: 'cue', id: 'urgent-volley' });
    }
    if (!result.fire) {
        return;
    }
    s.office.papers.push(...urgentShot(s.office.urgent));
}

export function applyPapers(
    s: CoreState,
    out: GameEvent[],
    result: { papers: Paper[]; hits: readonly PaperHit[] },
    dt: number,
): boolean {
    for (const hit of result.hits) {
        s.office.paperHits++;
        if (!applyFocusHit(s, out, hit.focus)) {
            s.office.papers = [
                ...result.papers.slice(0, hit.index + 1),
                ...s.office.papers.slice(hit.index + 1),
            ];
            return false;
        }
        if (hit.heavy) {
            s.p.vx = s.p.vx * 0.3 + hit.vx * 0.55;
            s.p.vy = Math.min(s.p.vy, -90);
            s.p.w += hit.vx * 0.002;
        } else {
            s.p.vx *= 0.88;
            s.p.w += hit.vx * 0.0009;
        }
        s.office.paperPenaltyRemaining = RULES.paperPenalty;
        out.push({ type: 'cue', id: hit.heavy ? 'bundle-hit' : 'paper-hit' });
    }
    s.office.papers = trimPapers(result.papers);
    out.push({ type: 'particles-step', dt });
    return true;
}
