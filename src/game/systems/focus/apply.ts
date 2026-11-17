import { focusAfterHit, focusLossStep } from './decide';
import { setActivity } from '../../state';

import type { FocusHit } from './decide';
import type { CoreState } from '../../state';
import type { GameEvent } from '../../types';
export function applyFocusHit(
    s: CoreState,
    out: GameEvent[],
    hit: FocusHit,
): boolean {
    if (s.mode !== 'play') {
        return false;
    }
    const r = focusAfterHit(s.focus, hit);
    if (!r) {
        return true;
    }
    s.focus = {
        value: r.value,
        recoveryClock: r.recoveryClock,
        processedEvents: r.processedEvents,
        notice: r.notice,
    };
    if (r.lost) {
        applyFocusFailure(s, out);
    }
    return !r.lost;
}

function applyFocusFailure(s: CoreState, out: GameEvent[]) {
    setActivity(s, {
        mode: 'focuslost',
        lossReason: 'focus',
        impact: null,
        focus: { ...s.focus, value: 0, recoveryClock: 0 },
    });
    s.focusLossTime = 0;
    s.deaths++;
    s.keys = [];
    out.push({ type: 'cue', id: 'focus-lost' });
}

export function applyFocusLoss(
    s: CoreState,
    out: GameEvent[],
    dt: number,
): void {
    if (s.mode !== 'focuslost') {
        return;
    }
    const r = focusLossStep(s.focusLossTime, dt);
    s.focusLossTime = r.time;
    if (r.over) {
        setActivity(s, {
            mode: 'dead',
            lossReason: 'focus',
            impact: null,
            focus: s.focus,
        });
        out.push({ type: 'cue', id: 'focus-game-over' });
    }
}
