import type { StageHooks } from '../types';
import { applyOrbit } from './course/apply';

export const orbitHooks: StageHooks = {
    takeover(s, out, dt) { applyOrbit(s, out, dt); return true; },
    canJump: () => false,
    canSpray: () => false,
};
