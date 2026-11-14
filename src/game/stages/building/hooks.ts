import type { StageHooks } from '../types';
import { STAGE_TWO } from './data';
import { inOrientation } from './corridor/decide';
import { meetingReachable, applyConvoyLanding, applyCorridor, applyInteract, applyLeaveMeeting, applyLiftRide, applyMeeting } from './corridor/apply';

export const buildingHooks: StageHooks = {
    takeover(s, out, dt) {
        return applyMeeting(s, dt) || applyLiftRide(s, out, dt);
    },
    // Jumping from anywhere in the convoy keeps its speed for a long leap.
    onJump(s) {
        const corridor = s.building.corridor;
        const lip = STAGE_TWO.express.pit.left;
        if (corridor.pace === 'express' && s.p.x >= STAGE_TWO.express.ramp.start && s.p.x < lip
            && (corridor.convoy === 'carried' || corridor.convoy === 'leading')) {
            s.p.vy = -STAGE_TWO.express.launch;
        }
        if (s.building.corridor.convoy === 'carried') s.building.corridor.convoy = 'airborne';
        else if (s.building.corridor.convoy === 'leading') s.building.corridor.convoy = 'leading-airborne';
    },
    drive(s, inputDir) {
        const convoyJump = (s.building.corridor.convoy === 'airborne' || s.building.corridor.convoy === 'leading-airborne') && !s.ground;
        const joined = s.building.corridor.convoy === 'carried' || s.building.corridor.convoy === 'leading';
        // During orientation a hop from the convoy is just a hop: it lands back among the chairs.
        const hop = convoyJump && s.building.corridor.pace === 'casual' && inOrientation(s.p.x);
        return {
            dir: joined || hop ? 0 : inputDir,
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
