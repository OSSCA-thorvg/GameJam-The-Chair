import { setPlayer, type CoreState } from '../../../state';
import type { GameEvent } from '../../../types';
import { entranceStep, flightStep, graphRideStep, rooftopStep } from './decide';
import * as Det from '../../../math';
import { FOCUS_DAMAGE } from '../../../level';
import { applyFocusHit } from '../../../systems/focus/apply';
export function applyRooftopEntrance(s: CoreState, dt: number) {
    if (s.rooftop.entrance.kind !== 'opening') return false;
    const r = entranceStep(s.rooftop.entrance, dt);
    s.rooftop.entrance = r.entrance;
    setPlayer(s, r.pose);
    s.ground = true;
    if (r.done) {
        s.keys = [];
        s.jumpQ = 0;
    }
    return true;
}

export function applyRooftop(s: CoreState, out: GameEvent[], dt: number) {
    const r = rooftopStep(
        {
            p: s.p,
            ground: s.ground,
            hasExtinguisher: s.extinguisher.owned,
            firstFlight: s.rooftop.flight,
            ductReaction: s.rooftop.duct,
            time: s.time,
        },
        dt,
    );
    setPlayer(s, r.p);
    s.ground = r.ground;
    s.rooftop.duct = r.ductReaction;
    for (const id of r.steamHits) {
        if (
            !applyFocusHit(s, out, {
                kind: 'steam',
                id,
                damage: FOCUS_DAMAGE.steam,
            })
        ) {
            return;
        }
    }
    if (s.rooftop.flight.kind === 'course' && r.firstFlight.kind === 'ride') {
        s.keys = [];
        s.jumpQ = 0;
        s.extinguisher.burst = 0.24;
        s.extinguisher.direction = { x: -1, y: 0 };
        s.ground = false;
        out.push({ type: 'cue', id: 'checkpoint' });
    }
    s.rooftop.flight = r.firstFlight;
    if (r.pickup) {
        s.extinguisher.owned = true;
        s.checkpoint = 1;
        out.push({ type: 'cue', id: 'extinguisher-pickup' });
        out.push({ type: 'cue', id: 'checkpoint' });
    }
}

export function applyFlight(
    s: CoreState,
    dt: number,
): false | 'flight' | 'arrived' {
    const flight = s.rooftop.flight;
    if (flight.kind === 'course') return false;
    if (flight.kind === 'ride') {
        const r = graphRideStep(flight, s.p, dt);
        s.rooftop.flight = r.flight;
        setPlayer(s, r.p);
        s.ground = false;
        s.extinguisher.burst = 0.24;
        s.extinguisher.direction = {
            x: -r.p.vx / Math.max(1, Det.hypot(r.p.vx, r.p.vy)),
            y: -r.p.vy / Math.max(1, Det.hypot(r.p.vx, r.p.vy)),
        };
        return 'flight';
    }
    const r = flightStep(flight, s.p, dt);
    s.rooftop.flight = r.flight;
    setPlayer(s, r.p);
    s.extinguisher.burst = 0.24;
    s.extinguisher.direction = { x: 0, y: 1 };
    return r.arrived ? 'arrived' : 'flight';
}
