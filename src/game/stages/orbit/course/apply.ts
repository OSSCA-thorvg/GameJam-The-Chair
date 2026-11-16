import { setPlayer, type CoreState } from '../../../state';
import type { GameEvent } from '../../../types';
import { inSatelliteLight, orbitStep } from './decide';
import { STAGE_FIVE } from '../data';
import { FOCUS_DAMAGE } from '../../../level';
import { applyFocusHit } from '../../../systems/focus/apply';
import { applyFocusRecovery } from '../../../systems/focus/recovery';

export function applyOrbit(s: CoreState, out: GameEvent[], dt: number) {
    const result = orbitStep(s.orbit, s.p, s.keys, dt);
    s.orbit = result.orbit;
    setPlayer(s, result.p);
    s.actualSpeed = s.orbit.speed;
    s.extinguisher.burst = result.spraying
        ? 0.24
        : Math.max(0, s.extinguisher.burst - dt);
    if (
        result.satelliteLit &&
        !applyFocusHit(s, out, {
            kind: 'satelliteLight',
            id: Math.floor(s.orbit.age),
            damage: FOCUS_DAMAGE.satelliteLight,
        })
    ) {
        return;
    }
    // Takeover skips shared focus recovery; apply it here.
    if (s.orbit.phase !== 'parked')
        applyFocusRecovery(s, dt, inSatelliteLight(s.orbit, s.p, s.orbit.z));
    if (result.flag > s.checkpoint) {
        s.focus.value = 100;
        s.focus.recoveryClock = 0;
        s.checkpoint = result.flag;
        out.push({ type: 'cue', id: 'checkpoint' });
    }
    if (result.checkpoint) {
        s.focus.value = 100;
        s.focus.recoveryClock = 0;
        s.checkpoint = STAGE_FIVE.restarts.length + 1;
        if (s.completedStage < 4) s.completedStage = 4;
        out.push({ type: 'cue', id: 'checkpoint' });
    }
}
