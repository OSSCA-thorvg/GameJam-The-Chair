import { setPlayer, type GameState } from '../../../state';
import type { GameEvent } from '../../../types';
import { orbitStep } from './decide';

export function applyOrbit(s: GameState, out: GameEvent[], dt: number) {
    const result = orbitStep(s.orbit, s.p, s.keys, dt);
    s.orbit = result.orbit;
    setPlayer(s, result.p);
    s.actualSpeed = s.orbit.speed;
    s.sprayBurst = s.orbit.phase === 'parked' ? 0 : .24;
    if (result.checkpoint) {
        s.checkpoint = 1;
        if (s.completedStage < 4) s.completedStage = 4;
        out.push({ type: 'cue', id: 'checkpoint' });
    }
}
