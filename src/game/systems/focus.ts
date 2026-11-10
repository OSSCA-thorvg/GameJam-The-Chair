import { waterExposure } from './cleaning';
import type { GameCore } from '../state';
import type { GameEvent } from '../types';

export function waterExposureActive(s: GameCore) {
    return waterExposure(s.bucket.age, s.p, s.cleaning.x);
}

export function focusBlocked(s: GameCore) {
    return s.paperPenaltyRemaining > 0 || s.lightPenaltyRemaining > 0 || waterExposureActive(s);
}

export type FocusKind = 'paper' | 'water' | 'light' | 'door';
// One distraction. The same kind and id only ever costs focus once per attempt.
export type FocusHit = { kind: FocusKind; id: number; damage: number };

export function focusHit(s: GameCore, out: GameEvent[], kind: FocusKind, id: number, damage: number) {
    if (s.mode !== 'play') return;
    const token = kind + ':' + id;
    if (s.focusEvents.includes(token)) return;
    s.focusEvents.push(token);
    s.focus = Math.max(0, s.focus - damage);
    s.focusClock = 0;
    s.focusNotice = { kind, life: 1.7 };
    if (s.focus === 0) {
        focusFailure(s, out);
    }
}

export function focusFailure(s: GameCore, out: GameEvent[]) {
    if (s.mode !== 'play') return;
    s.mode = 'focuslost';
    s.lossReason = 'focus';
    s.focusLossTime = 0;
    s.focus = 0;
    s.focusClock = 0;
    s.deaths++;
    s.keys = [];
    out.push({ type: 'cue', id: 'focus-lost' });
}

export function advanceFocusLoss(s: GameCore, out: GameEvent[], dt: number) {
    if (s.mode !== 'focuslost') return;
    s.focusLossTime += dt;
    if (s.focusLossTime >= 1.7) {
        s.mode = 'dead';
        out.push({ type: 'cue', id: 'focus-game-over' });
    }
}

export function focusStep(s: GameCore, dt: number) {
    if (s.focusNotice && (s.focusNotice.life -= dt) <= 0) {
        s.focusNotice = null;
    }
    if (focusBlocked(s)) {
        s.focusClock = 0;
        return;
    }
    if (s.focus >= 100) {
        s.focusClock = 0;
        return;
    }
    s.focusClock += dt;
    if (s.focusClock >= 2 - 1e-9) {
        const amount = Math.floor((s.focusClock + 1e-9) / 2);
        s.focus = Math.min(100, s.focus + amount);
        s.focusClock = Math.max(0, s.focusClock - amount * 2);
    }
}
