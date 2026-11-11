// Stage 4 · Above the clouds: the sky course runs its own movement every tick.
import type { StageHooks } from '../types';
import { applySky } from './course/apply';

export const skyHooks: StageHooks = {
    takeover(s, out, dt) {
        applySky(s, out, dt);
        return true;
    },
    // The extinguisher is the engine on arrival and in the reveal; manual sprays only on the course.
    canSpray: s => s.sky.phase === 'course',
};
