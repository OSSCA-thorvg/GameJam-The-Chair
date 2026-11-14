import { setPlayer, type GameState } from '../../../state';
import type { GameEvent } from '../../../types';
import { orbitStep } from './decide';
import { FOCUS_DAMAGE } from '../../../level';
import { applyFocusHit, applyFocusRecovery } from '../../../systems/focus/apply';

export function applyOrbit(s: GameState, out: GameEvent[], dt: number) {
    const result = orbitStep(s.orbit, s.p, s.keys, dt);
    s.orbit = result.orbit;
    setPlayer(s, result.p);
    s.actualSpeed = s.orbit.speed;
    // The plume shows while the extinguisher pushes and trails off for a moment after.
    s.sprayBurst = result.spraying ? .24 : Math.max(0, s.sprayBurst - dt);
    if (result.satelliteLit && !applyFocusHit(s, out, { kind: 'satelliteLight', id: Math.floor(s.orbit.age), damage: FOCUS_DAMAGE.satelliteLight })) return;
    // The takeover skips the shared tick, so focus comes back here (not while the beam is on the chair).
    if (s.orbit.phase !== 'parked') applyFocusRecovery(s, dt);
    if (result.checkpoint) {
        s.focus = 100;
        s.focusClock = 0;
        s.checkpoint = 1;
        if (s.completedStage < 4) s.completedStage = 4;
        out.push({ type: 'cue', id: 'checkpoint' });
    }
}
