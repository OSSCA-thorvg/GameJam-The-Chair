// Stage 3 · Rooftop: the door scene, the duct, the extinguisher pickup and the take-off to the sky.
import { startStage } from '../../state';
import type { StageHooks } from '../types';
import { applyFlight, applyRooftop, applyRooftopEntrance, applyRooftopSpray } from './course/apply';
import { onSlickPaper } from './data';

export const rooftopHooks: StageHooks = {
    takeover(s, out, dt) {
        if (applyRooftopEntrance(s, dt)) return true;
        const flight = applyFlight(s, dt);
        if (!flight) return false;
        if (flight === 'arrived') {
            // Reaching the clouds clears the rooftop and continues straight into the sky stage.
            if (s.completedStage < 3) s.completedStage = 3;
            const arrival = { ...s.p };
            startStage(s, 4, out);
            s.p = arrival;
            s.ground = false;
        }
        return true;
    },
    // Once the duct has scattered its printouts, landing on them is like rolling on spilled water.
    drive: s => s.rooftop.duct.kind !== 'idle' && onSlickPaper(s.p, s.ground) ? { slip: true } : {},
    afterCollide(s, out, dt) {
        applyRooftop(s, out, dt);
    },
    // Picking up the extinguisher is flag 1; later flags count only with it in hand.
    checkpointsOpen: s => s.hasExtinguisher,
    canJump: s => s.rooftop.entrance.kind !== 'opening',
    // No manual sprays once the take-off is under way.
    canSpray: s => s.rooftop.flight.kind !== 'flight',
    onSpray: (s, direction) => applyRooftopSpray(s, direction),
};
