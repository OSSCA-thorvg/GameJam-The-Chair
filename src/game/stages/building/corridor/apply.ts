import { setPlayer, type GameState } from '../../../state';
import type { GameEvent } from '../../../types';
import { applyFocusHit } from '../../../systems/focus/apply';
import { STAGES } from '../../index';
import { STAGE_TWO } from '../data';
import { canEnterMeeting, convoyLanding, corridorStep, liftRide, meetingExit, meetingStep } from './decide';
export function applyConvoyLanding(s: GameState) {
    const r = convoyLanding(s.building.corridor, s.building.furniture, s.p, s.ground);
    if (!r) return;
    s.building.corridor.convoy = r.convoy;
    if (r.vx !== null) s.p.vx = r.vx;
}

// Returns true while the lift carries the rider down.
export function applyLiftRide(s: GameState, out: GameEvent[], dt: number) {
    const r = liftRide(s.building.corridor.departure, dt);
    if (!r) return false;
    s.building.corridor.departure = r.departure;
    setPlayer(s, { x: s.p.x, y: r.y, vx: 0, vy: 0, a: 0, w: 0 });
    s.ground = false;
    s.actualSpeed = 0;
    s.jumpQ = s.coyote = 0;
    if (r.lost) {
        s.building.corridor.lift = { kind: 'departed' };
        s.building.corridor.convoy = 'free';
        s.mode = 'dead';
        s.lossReason = 'lift';
        s.deaths++;
        s.keys = [];
        out.push({ type: 'cue', id: 'lift-game-over' });
    }
    return true;
}

export function applyCorridor(s: GameState, out: GameEvent[], dt: number, previousX: number) {
    const r = corridorStep({
        corridor: s.building.corridor, furniture: s.building.furniture, p: s.p, ground: s.ground,
        steering: s.keys.includes('left') || s.keys.includes('right'),
        rng: s.rng.cosmetic, length: STAGES[s.stage].length,
    }, dt, previousX);
    s.building.corridor = r.corridor;
    s.building.furniture = r.furniture;
    setPlayer(s, r.p);
    s.rng.cosmetic = r.rng;
    if (r.stopRider) s.jumpQ = s.coyote = 0;
    if (r.kick) {
        s.ground = false;
        s.coyote = 0;
        s.jumpQ = 0;
    }
    if (r.kick === 'bump') {
        out.push({ type: 'cue', id: 'convoy-bump' });
        applyFocusHit(s, out, { kind: 'bump', id: 0, damage: 10 });
    } else if (r.kick === 'trip') {
        out.push({ type: 'cue', id: 'convoy-bump' });
        applyFocusHit(s, out, { kind: 'bump', id: 1 + r.tripped, damage: STAGE_TWO.orientation.damage });
    }
}

// Returns true while the meeting scene owns the rider.
export function applyMeeting(s: GameState, dt: number) {
    if (s.building.corridor.room.kind === 'corridor') return false;
    const r = meetingStep(s.building.corridor.room, dt);
    s.building.corridor.room = r.room;
    s.p.x = r.x;
    if (r.leave) applyLeaveMeeting(s, true);
    return true;
}

export function applyLeaveMeeting(s: GameState, pushed = false) {
    const room = s.building.corridor.room;
    if (room.kind === 'corridor') return;
    setPlayer(s, meetingExit(room.returnX, pushed));
    s.building.corridor.room = { kind: 'corridor' };
    s.keys = [];
    s.jumpQ = 0;
    s.ground = true;
    s.actualSpeed = 0;
}

export function meetingReachable(s: Readonly<GameState>) {
    return canEnterMeeting({ stage: s.stage, mode: s.mode, corridor: s.building.corridor, p: s.p, ground: s.ground });
}

export function applyInteract(s: GameState) {
    if (s.mode !== 'play') return;
    if (s.building.corridor.room.kind !== 'corridor') { applyLeaveMeeting(s); return; }
    if (!meetingReachable(s)) return;
    s.building.corridor.room = { kind: 'entering', age: 0, returnX: s.p.x };
    s.building.corridor.meetingVisited = true;
    setPlayer(s, { ...s.p, vx: 0, vy: 0, a: 0, w: 0 });
    s.keys = [];
    s.jumpQ = 0;
    s.actualSpeed = 0;
}
