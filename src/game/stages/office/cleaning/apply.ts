// Writes the decisions from ./decide into game state. The only place this system changes state.
import type { GameState } from '../../../state';
import type { GameEvent } from '../../../types';
import { applyFocusHit } from '../../../systems/focus/apply';
import type { CleaningResult } from './decide';
export function applyCleaning(s: GameState, out: GameEvent[], result: CleaningResult, dt: number) {
    s.office.cleaning = result.cleaning;
    s.office.bucket = result.bucket;
    if (result.splash) {
        out.push({ type: 'water-splash', x: s.office.cleaning.x, side: s.office.cleaning.splashDir });
        out.push({ type: 'cue', id: 'water-spilled' });
        out.push({ type: 'cue', id: 'water-comment' });
    }
    if (result.followup) out.push({ type: 'cue', id: 'water-followup' });
    if (result.soak) {
        s.office.soakedOnSpill = s.office.bucket.spills;
        if (!applyFocusHit(s, out, result.soak)) return false;
    }
    out.push({ type: 'water-step', dt });
    return true;
}
