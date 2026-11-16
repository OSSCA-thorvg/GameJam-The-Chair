import type { CoreState } from '../../state';
import { stageHooks } from '../../stages/hooks';
import type { GameEvent } from '../../types';
import { focusAfterHit, focusLossStep, focusRecovery, type FocusHit } from './decide';
export function applyFocusHit(s: CoreState, out: GameEvent[], hit: FocusHit) {
    if (s.mode !== 'play') return false;
    const r = focusAfterHit(s.focus, hit);
    if (!r) return true;
    s.focus = { value: r.value, recoveryClock: r.recoveryClock, processedEvents: r.processedEvents, notice: r.notice };
    if (r.lost) applyFocusFailure(s, out);
    return s.mode === 'play';
}

function applyFocusFailure(s: CoreState, out: GameEvent[]) {
    s.mode = 'focuslost';
    s.lossReason = 'focus';
    s.focusLossTime = 0;
    s.focus.value = 0;
    s.focus.recoveryClock = 0;
    s.deaths++;
    s.keys = [];
    out.push({ type: 'cue', id: 'focus-lost' });
}

export function applyFocusLoss(s: CoreState, out: GameEvent[], dt: number) {
    if (s.mode !== 'focuslost') return;
    const r = focusLossStep(s.focusLossTime, dt);
    s.focusLossTime = r.time;
    if (r.over) {
        s.mode = 'dead';
        out.push({ type: 'cue', id: 'focus-game-over' });
    }
}

export function focusBlockedIn(s: Readonly<CoreState>) {
    return stageHooks(s.stage).focusBlocked?.(s) ?? false;
}

export function applyFocusRecovery(s: CoreState, dt: number) {
    Object.assign(s.focus, focusRecovery(s.focus, focusBlockedIn(s), dt));
}
