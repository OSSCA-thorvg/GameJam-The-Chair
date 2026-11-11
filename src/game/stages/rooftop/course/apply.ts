// Writes the decisions from ./decide into game state. The only place this system changes state.
import { setPlayer, type GameState } from '../../../state';
import type { GameEvent } from '../../../types';
import { ductSprayed, entranceStep, flightStep, launchShot, rooftopStep } from './decide';
// Returns true while the rooftop door scene owns the chair.
export function applyRooftopEntrance(s: GameState, dt: number) {
    if (s.rooftopEntrance.kind !== 'opening') return false;
    const r = entranceStep(s.rooftopEntrance, dt);
    s.rooftopEntrance = r.entrance;
    setPlayer(s, r.pose);
    s.ground = true;
    if (r.done) {
        s.keys = [];
        s.jumpQ = 0;
    }
    return true;
}

export function applyRooftop(s: GameState, out: GameEvent[], dt: number) {
    const r = rooftopStep(s, dt);
    setPlayer(s, r.p);
    s.ground = r.ground;
    s.ductReaction = r.ductReaction;
    s.firstFlight = r.firstFlight;
    if (r.pickup) {
        s.hasExtinguisher = true;
        s.checkpoint = 1;
        out.push({ type: 'cue', id: 'extinguisher-pickup' });
        out.push({ type: 'cue', id: 'checkpoint' });
    }
}

// A spray on the rooftop can wake the duct and counts toward the launch.
export function applyRooftopSpray(s: GameState, direction: number) {
    if (s.stage !== 3) return;
    s.ductReaction = ductSprayed(s.ductReaction, s.p);
    const r = launchShot(s.firstFlight, s.p, s.time, direction);
    s.firstFlight = r.firstFlight;
    setPlayer(s, r.p);
    if (r.takeoff) {
        s.keys = [];
        s.jumpQ = 0;
    }
}

// Returns 'flight' while climbing, 'arrived' on reaching the sky, false when not flying.
export function applyFlight(s: GameState, dt: number): false | 'flight' | 'arrived' {
    if (s.firstFlight.kind !== 'flight') return false;
    const r = flightStep(s.firstFlight, s.p, dt);
    s.firstFlight = r.flight;
    setPlayer(s, r.p);
    s.sprayBurst = .24;
    s.sprayDir = { x: 0, y: 1 };
    return r.arrived ? 'arrived' : 'flight';
}
