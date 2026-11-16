import { startStage } from '../../state';
import type { StageHooks } from '../types';
import {
    applyFlight,
    applyRooftop,
    applyRooftopEntrance,
} from './course/apply';
import { STAGE_THREE, onSlickPaper } from './data';
import { STAGE_FOUR } from '../sky/data';

export const rooftopHooks: StageHooks = {
    takeover(s, out, dt) {
        if (applyRooftopEntrance(s, dt)) return true;
        const flight = applyFlight(s, dt);
        if (!flight) return false;
        if (flight === 'arrived') {
            if (s.completedStage < 3) s.completedStage = 3;
            const arrival = { ...s.p, x: STAGE_FOUR.spawn.x };
            startStage(s, 4, out);
            s.p = arrival;
            s.ground = false;
        }
        return true;
    },
    drive: (s) =>
        s.rooftop.duct.kind !== 'idle' && onSlickPaper(s.p, s.ground)
            ? { slip: true }
            : {},
    afterCollide(s, out, dt) {
        applyRooftop(s, out, dt);
        if (s.ground) s.rooftop.airSprays = 0;
    },
    checkpointsOpen: (s) => s.extinguisher.owned,
    canJump: (s) => s.rooftop.entrance.kind !== 'opening',
    canSpray: (s) =>
        s.rooftop.flight.kind === 'course' &&
        s.rooftop.airSprays < STAGE_THREE.airSprayLimit,
    onSpray: (s) => {
        s.rooftop.airSprays++;
    },
};
