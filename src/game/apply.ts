import type { GameState } from './state';
import type { GameEvent } from './types';
import { focusHit, type FocusHit } from './systems/focus';
import type { GeyserHit } from './systems/geyser';
import type { MonitorContact } from './systems/monitor';
import { RULES } from './level';

// The only place where system decisions are written into game state. Systems decide; these apply.
// Each applier returns false when the attempt stopped (focus lost, death) so the step can end early.

export function applyFocusHit(s: GameState, out: GameEvent[], hit: FocusHit) {
    focusHit(s, out, hit.kind, hit.id, hit.damage);
    return s.mode === 'play';
}

export function applyGeyserHits(s: GameState, out: GameEvent[], hits: readonly GeyserHit[]) {
    for (const hit of hits) {
        s.p.vy = -520;
        s.p.vx += hit.push;
        s.p.w += hit.spin;
        s.rng.physics = hit.rng;
        if (!applyFocusHit(s, out, hit.focus)) return false;
        out.push({ type: 'cue', id: 'light-hit' });
    }
    return true;
}

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
