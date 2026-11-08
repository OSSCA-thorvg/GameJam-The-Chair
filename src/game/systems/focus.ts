import { LEVEL, RULES } from '../level';
import type { GameCore } from '../core';

export function waterExposureActive(s: GameCore) {
    const F = LEVEL.floor;
    return s.bucket.age < RULES.waterExposure && Math.abs(s.p.x - s.cleaning.x) < 210 && s.p.y > F - 150;
}

export function focusBlocked(s: GameCore) {
    return s.paperPenaltyRemaining > 0 || s.lightPenaltyRemaining > 0 || waterExposureActive(s);
}

export function focusHit(s: GameCore, kind: 'paper' | 'water' | 'light' | 'door' | 'cart', id: number) {
    if (s.mode !== 'play') return;
    const token = kind + ':' + id;
    if (s.focusEvents.has(token)) return;
    s.focusEvents.add(token);
    s.focus = Math.max(0, s.focus - 30);
    s.focusClock = 0;
    s.focusNotice = { kind, life: 1.7 };
    if (s.focus === 0) {
        focusFailure(s);
    }
}

export function focusFailure(s: GameCore) {
    if (s.mode !== 'play') return;
    s.mode = 'focuslost';
    s.lossReason = 'focus';
    s.focusLossTime = 0;
    s.focus = 0;
    s.focusClock = 0;
    s.deaths++;
    s.keys.clear();
    s.acc = 0;
    s.events.push({ type: 'cue', id: 'focus-lost' });
}

export function advanceFocusLoss(s: GameCore, dt: number) {
    if (s.mode !== 'focuslost') return;
    s.focusLossTime += dt;
    if (s.focusLossTime >= 1.7) {
        s.mode = 'dead';
        s.events.push({ type: 'cue', id: 'focus-game-over' });
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
