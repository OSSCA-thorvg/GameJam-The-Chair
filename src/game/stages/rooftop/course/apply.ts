// Writes the decisions from ./decide into game state. The only place this system changes state.
import { setPlayer, type GameState } from '../../../state';
import type { GameEvent } from '../../../types';
import { ductSprayed, entranceStep, flightStep, graphRideStep, rooftopStep } from './decide';
// Returns true while the rooftop door scene owns the chair.
export function applyRooftopEntrance(s: GameState, dt: number) {
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

export function applyRooftop(s: GameState, out: GameEvent[], dt: number) {
    const r = rooftopStep({ p: s.p, ground: s.ground, hasExtinguisher: s.hasExtinguisher, firstFlight: s.rooftop.flight, ductReaction: s.rooftop.duct, time: s.time }, dt);
    setPlayer(s, r.p);
    s.ground = r.ground;
    s.rooftop.duct = r.ductReaction;
    if (s.rooftop.flight.kind === 'course' && r.firstFlight.kind === 'ride') {
        s.keys = [];
        s.jumpQ = 0;
        s.sprayBurst = .24;
        s.sprayDir = { x: -1, y: 0 };
        s.ground = false;
        out.push({ type: 'cue', id: 'checkpoint' });
    }
    s.rooftop.flight = r.firstFlight;
    if (r.pickup) {
        s.hasExtinguisher = true;
        s.checkpoint = 1;
        out.push({ type: 'cue', id: 'extinguisher-pickup' });
        out.push({ type: 'cue', id: 'checkpoint' });
    }
}

// A spray on the rooftop can wake the duct.
export function applyRooftopSpray(s: GameState) {
    if (s.stage !== 3) return;
    s.rooftop.duct = ductSprayed(s.rooftop.duct, s.p);
}

// Returns 'flight' while riding the graph or climbing, 'arrived' on reaching the sky, false otherwise.
export function applyFlight(s: GameState, dt: number): false | 'flight' | 'arrived' {
    const flight = s.rooftop.flight;
    if (flight.kind === 'course') return false;
    if (flight.kind === 'ride') {
        const r = graphRideStep(flight, s.p, dt);
        s.rooftop.flight = r.flight;
        setPlayer(s, r.p);
        s.ground = false;
        // The extinguisher roars backwards along the line like a booster.
        s.sprayBurst = .24;
        s.sprayDir = { x: -r.p.vx / Math.max(1, Math.hypot(r.p.vx, r.p.vy)), y: -r.p.vy / Math.max(1, Math.hypot(r.p.vx, r.p.vy)) };
        return 'flight';
    }
    const r = flightStep(flight, s.p, dt);
    s.rooftop.flight = r.flight;
    setPlayer(s, r.p);
    s.sprayBurst = .24;
    s.sprayDir = { x: 0, y: 1 };
    return r.arrived ? 'arrived' : 'flight';
}
