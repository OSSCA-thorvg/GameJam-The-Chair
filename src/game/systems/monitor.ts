import { RULES } from '../level';
import type { GameCore } from '../core';
import { focusHit } from './focus';

export function monitorPhase(s: GameCore) {
    const phase = s.t % s.monitor.period;
    return {
        phase,
        warning: phase < .8,
        active: phase >= .8 && phase < 2.1,
        remaining: phase < .8 ? .8 - phase : phase < 2.1 ? 2.1 - phase : s.monitor.period - phase,
    };
}

export function monitorStep(s: GameCore, _dt: number, previousX: number) {
    const m = monitorPhase(s);
    if (!m.active || s.p.y + 28 < 300) return;
    if (s.p.x + 35 > s.monitor.wall - 8 && s.p.x - 35 < s.monitor.wall + 22) {
        const side = previousX < s.monitor.wall ? -1 : 1;
        s.p.x = s.monitor.wall + side * 45;
        s.p.vx = side * 65;
        s.p.w *= .45;
        s.lightPenaltyRemaining = RULES.lightPenalty;
        s.events.push({ type: 'light-contact' });
        if (s.lightCooldown === 0) {
            s.lightHits++;
            s.lightCooldown = 1.4;
            focusHit(s, 'light', Math.floor(s.t / s.monitor.period));
            if (s.mode !== 'play') return;
            s.events.push({ type: 'cue', id: 'light-hit' });
            s.events.push({ type: 'cue', id: 'light-comment' });
        }
    }
}
