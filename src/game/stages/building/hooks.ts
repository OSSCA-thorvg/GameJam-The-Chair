// Stage 2 · Inside the building: the meeting room, the chair convoy and the lift.
import type { StageHooks } from '../types';
import { meetingReachable, applyConvoyLanding, applyCorridor, applyInteract, applyLeaveMeeting, applyLiftRide, applyMeeting } from './corridor/apply';

export const buildingHooks: StageHooks = {
    takeover(s, out, dt) {
        return applyMeeting(s, dt) || applyLiftRide(s, out, dt);
    },
    // Jumping from anywhere in the convoy keeps its speed for a long leap.
    onJump(s) {
        if (s.building.corridor.convoy === 'carried') s.building.corridor.convoy = 'airborne';
        else if (s.building.corridor.convoy === 'leading') s.building.corridor.convoy = 'leading-airborne';
    },
    drive(s, inputDir) {
        const convoyJump = (s.building.corridor.convoy === 'airborne' || s.building.corridor.convoy === 'leading-airborne') && !s.ground;
        const joined = s.building.corridor.convoy === 'carried' || s.building.corridor.convoy === 'leading';
        return {
            dir: joined ? 0 : inputDir,
            convoyJump,
            expressJump: convoyJump && s.building.corridor.pace === 'express',
        };
    },
    afterMove(s, out, dt, previousX) {
        applyCorridor(s, out, dt, previousX);
        return false;
    },
    afterCollide(s) {
        applyConvoyLanding(s);
    },
    canJump: s => s.building.corridor.room.kind === 'corridor',
    interact: s => applyInteract(s),
    leave: s => { if (s.mode === 'play') applyLeaveMeeting(s); },
    canInteract: s => meetingReachable(s),
};
