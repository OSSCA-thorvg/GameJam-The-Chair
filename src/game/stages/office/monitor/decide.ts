import { FOCUS_DAMAGE, LEVEL } from '../../../level';
import type { Point } from '../../../types';
import type { FocusHit } from '../../../systems/focus/decide';

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

export type MonitorContact = { index: number; x: number; vx: number; focus: FocusHit };

// The first lit monitor the chair touches pushes it back to the side it came from.
export function monitorContact(p: Readonly<Point>, previousX: number, time: number): MonitorContact | null {
    if (p.y + 28 < 300) return null;
    for (let i = 0; i < LEVEL.monitors.length; i++) {
        const spec = LEVEL.monitors[i];
        if (!monitorPhase(spec, time).active) continue;
        if (p.x + 35 > spec.wall - 8 && p.x - 35 < spec.wall + 22) {
            const side = previousX < spec.wall ? -1 : 1;
            return {
                index: i,
                x: side < 0 ? spec.wall - 45 : spec.wall + 65,
                vx: side * 65,
                focus: { kind: 'light', id: i * 1000 + Math.floor(time / spec.period), damage: FOCUS_DAMAGE.light },
            };
        }
    }
    return null;
}
