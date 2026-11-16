import { RULES } from '../../../level';
import { applyFocusHit } from '../../../systems/focus/apply';

import type { MonitorContact } from './decide';
import type { CoreState } from '../../../state';
import type { GameEvent } from '../../../types';
export function applyMonitorContact(
    s: CoreState,
    out: GameEvent[],
    contact: MonitorContact | null,
): boolean {
    if (!contact) {
        return true;
    }
    s.p.x = contact.x;
    s.p.vx = contact.vx;
    s.p.w *= 0.45;
    s.office.lightPenaltyRemaining = RULES.lightPenalty;
    out.push({ type: 'light-contact' });
    if (s.office.lightCooldown !== 0) {
        return true;
    }
    s.office.lightHits++;
    s.office.lightCooldown = 1.4;
    if (!applyFocusHit(s, out, contact.focus)) {
        return false;
    }
    out.push({ type: 'cue', id: 'light-hit' });
    out.push({ type: 'cue', id: 'light-comment', monitorIndex: contact.index });
    return true;
}
