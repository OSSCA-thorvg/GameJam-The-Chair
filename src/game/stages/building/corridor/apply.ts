// Writes the decisions from ./decide into game state. The only place this system changes state.
import { setPlayer, type GameState } from '../../../state';
import type { GameEvent } from '../../../types';
import { STAGES } from '../../index';
import { MEETING_SEAT, canEnterMeeting, convoyLanding, corridorStep, liftRide, meetingExit, meetingStep } from './decide';
export function applyConvoyLanding(s: GameState) {
    const r = convoyLanding(s.corridor, s.furniture, s.p, s.ground);
    if (!r) return;
    s.corridor.convoy = r.convoy;
    if (r.vx !== null) s.p.vx = r.vx;
}

// Returns true while the lift carries the rider down.
export function applyLiftRide(s: GameState, out: GameEvent[], dt: number) {
    const r = liftRide(s.corridor.departure, dt);
    if (!r) return false;
    s.corridor.departure = r.departure;
    setPlayer(s, { x: s.p.x, y: r.y, vx: 0, vy: 0, a: 0, w: 0 });
    s.ground = false;
    s.actualSpeed = 0;
    s.jumpQ = s.coyote = 0;
    if (r.lost) {
        s.corridor.lift = { kind: 'departed' };
        s.corridor.convoy = 'free';
        s.mode = 'dead';
        s.lossReason = 'lift';
        s.deaths++;
        s.keys = [];
        out.push({ type: 'cue', id: 'lift-game-over' });
    }
    return true;
}

export function applyCorridor(s: GameState, dt: number, previousX: number) {
    const r = corridorStep({
        corridor: s.corridor, furniture: s.furniture, p: s.p, ground: s.ground,
        steering: s.keys.includes('left') || s.keys.includes('right'),
        rng: s.rng.cosmetic, length: STAGES[s.stage].length,
    }, dt, previousX);
    s.corridor = r.corridor;
    s.furniture = r.furniture;
    setPlayer(s, r.p);
    s.rng.cosmetic = r.rng;
    if (r.stopRider) s.jumpQ = s.coyote = 0;
}

// Returns true while the meeting scene owns the rider.
export function applyMeeting(s: GameState, dt: number) {
    if (s.corridor.room.kind !== 'meeting') return false;
    const r = meetingStep(s.corridor.room, dt);
    s.corridor.room = r.room;
    s.p.x = r.x;
    if (r.leave) applyLeaveMeeting(s, true);
    return true;
}

export function applyLeaveMeeting(s: GameState, pushed = false) {
    const room = s.corridor.room;
    if (room.kind !== 'meeting') return;
    setPlayer(s, meetingExit(room.returnX, pushed));
    s.corridor.room = { kind: 'corridor' };
    s.keys = [];
    s.jumpQ = 0;
    s.ground = true;
    s.actualSpeed = 0;
}

export function applyInteract(s: GameState) {
    if (s.mode !== 'play') return;
    if (s.corridor.room.kind === 'meeting') { applyLeaveMeeting(s); return; }
    if (!canEnterMeeting(s)) return;
    s.corridor.room = { kind: 'meeting', age: 0, returnX: s.p.x };
    s.corridor.meetingVisited = true;
    setPlayer(s, MEETING_SEAT);
    s.keys = [];
    s.jumpQ = 0;
    s.actualSpeed = 0;
}
