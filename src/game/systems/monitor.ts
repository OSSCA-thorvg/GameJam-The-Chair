import { LEVEL, RULES } from '../level';
import type { GameCore } from '../core';
import { focusHit } from './focus';

export type MonitorSpec = { wall: number; period: number; offset: number };
export function monitorPhase(m: MonitorSpec, t: number) {
    const phase = ((t + m.offset) % m.period + m.period) % m.period;
    return {
        phase,
        warning: phase < .8,
        active: phase >= .8 && phase < 2.1,
        remaining: phase < .8 ? .8 - phase : phase < 2.1 ? 2.1 - phase : m.period - phase,
    };
}

export function monitorStep(s: GameCore, _dt: number, previousX: number) {
    if (s.p.y + 28 < 300) return;
    for (let i = 0; i < LEVEL.monitors.length; i++) {
        const spec = LEVEL.monitors[i];
        const m = monitorPhase(spec, s.t);
        if (!m.active) continue;
        if (s.p.x + 35 > spec.wall - 8 && s.p.x - 35 < spec.wall + 22) {
            const side = previousX < spec.wall ? -1 : 1;
            s.p.x = spec.wall + side * 45;
            s.p.vx = side * 65;
            s.p.w *= .45;
            s.lightPenaltyRemaining = RULES.lightPenalty;
            s.events.push({ type: 'light-contact' });
            if (s.lightCooldown === 0) {
                s.lightHits++;
                s.lightCooldown = 1.4;
                focusHit(s, 'light', i * 1000 + Math.floor(s.t / spec.period));
                if (s.mode !== 'play') return;
                s.events.push({ type: 'cue', id: 'light-hit' });
                s.events.push({ type: 'cue', id: 'light-comment', monitorIndex: i });
            }
            return;
        }
    }
}
