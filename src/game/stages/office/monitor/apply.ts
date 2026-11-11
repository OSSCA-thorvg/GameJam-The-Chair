// Writes the decisions from ./decide into game state. The only place this system changes state.
import { RULES } from '../../../level';
import type { GameState } from '../../../state';
import type { GameEvent } from '../../../types';
import { applyFocusHit } from '../../../systems/focus/apply';
import type { MonitorContact } from './decide';
export function applyMonitorContact(s: GameState, out: GameEvent[], contact: MonitorContact | null) {
    if (!contact) return true;
    s.p.x = contact.x;
    s.p.vx = contact.vx;
    s.p.w *= .45;
    s.lightPenaltyRemaining = RULES.lightPenalty;
    out.push({ type: 'light-contact' });
    if (s.lightCooldown !== 0) return true;
    s.lightHits++;
    s.lightCooldown = 1.4;
    if (!applyFocusHit(s, out, contact.focus)) return false;
    out.push({ type: 'cue', id: 'light-hit' });
    out.push({ type: 'cue', id: 'light-comment', monitorIndex: contact.index });
    return true;
}
