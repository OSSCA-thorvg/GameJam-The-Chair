// Stage 2 · Inside the building: the meeting room, the chair convoy and the lift.
import type { StageHooks } from '../types';
import { canEnterMeeting } from './corridor/decide';
import { applyConvoyLanding, applyCorridor, applyInteract, applyLeaveMeeting, applyLiftRide, applyMeeting } from './corridor/apply';

export const buildingHooks: StageHooks = {
    takeover(s, out, dt) {
        return applyMeeting(s, dt) || applyLiftRide(s, out, dt);
    },
    // Jumping off the carried convoy keeps its speed for a long leap.
    onJump(s) {
        if (s.corridor.convoy === 'carried') s.corridor.convoy = 'airborne';
    },
    drive(s, inputDir) {
        const convoyJump = s.corridor.convoy === 'airborne' && !s.ground;
        return {
            dir: s.corridor.convoy === 'carried' ? 0 : inputDir,
            convoyJump,
            expressJump: convoyJump && s.corridor.pace === 'express',
        };
    },
    afterMove(s, _out, dt, previousX) {
        applyCorridor(s, dt, previousX);
        return false;
    },
    afterCollide(s) {
        applyConvoyLanding(s);
    },
    canJump: s => s.corridor.room.kind !== 'meeting',
    interact: s => applyInteract(s),
    leave: s => { if (s.mode === 'play') applyLeaveMeeting(s); },
    canInteract: s => canEnterMeeting(s),
};
