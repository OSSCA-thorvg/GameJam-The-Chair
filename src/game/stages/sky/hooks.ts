import type { StageHooks } from '../types';
import { applySky } from './course/apply';
import { STAGE_FOUR } from './data';

export const skyHooks: StageHooks = {
    takeover(s, out, dt) {
        applySky(s, out, dt);
        return true;
    },
    canSpray: s => s.sky.phase === 'course' && s.sky.airSprays < STAGE_FOUR.airSprayLimit,
    onSpray: s => { s.sky.airSprays++; },
};
