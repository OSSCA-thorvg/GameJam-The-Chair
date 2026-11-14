import type { StageHooks } from '../types';
import { applyOrbit } from './course/apply';
import { inSatelliteLight } from './course/decide';

export const orbitHooks: StageHooks = {
    takeover(s, out, dt) { applyOrbit(s, out, dt); return true; },
    canJump: () => false,
    canSpray: () => false,
    focusBlocked: s => inSatelliteLight(s.orbit, s.p, s.orbit.z),
};
