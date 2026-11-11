// Writes the decisions from ./decide into game state. The only place this system changes state.
import type { GameState } from '../../state';
import type { GameEvent } from '../../types';
import { focusAfterHit, focusBlocked, focusLossStep, focusRecovery, type FocusHit } from './decide';
// Returns false once play has stopped, so callers skip the rest of their effects.
export function applyFocusHit(s: GameState, out: GameEvent[], hit: FocusHit) {
    if (s.mode !== 'play') return false;
    const r = focusAfterHit(s, hit);
    if (!r) return true;
    s.focus = r.focus;
    s.focusClock = r.focusClock;
    s.focusEvents = [...r.focusEvents];
    s.focusNotice = r.focusNotice;
    if (r.lost) applyFocusFailure(s, out);
    return s.mode === 'play';
}

function applyFocusFailure(s: GameState, out: GameEvent[]) {
    s.mode = 'focuslost';
    s.lossReason = 'focus';
    s.focusLossTime = 0;
    s.focus = 0;
    s.focusClock = 0;
    s.deaths++;
    s.keys = [];
    out.push({ type: 'cue', id: 'focus-lost' });
}

export function applyFocusLoss(s: GameState, out: GameEvent[], dt: number) {
    if (s.mode !== 'focuslost') return;
    const r = focusLossStep(s.focusLossTime, dt);
    s.focusLossTime = r.time;
    if (r.over) {
        s.mode = 'dead';
        out.push({ type: 'cue', id: 'focus-game-over' });
    }
}

export function applyFocusRecovery(s: GameState, dt: number) {
    Object.assign(s, focusRecovery(s, focusBlocked(s), dt));
}
