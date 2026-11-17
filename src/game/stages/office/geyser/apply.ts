import { applyFocusHit } from '../../../systems/focus/apply';

import type { GeyserHit } from './decide';
import type { CoreState } from '../../../state';
import type { GameEvent } from '../../../types';
export function applyGeyserHits(
    s: CoreState,
    out: GameEvent[],
    hits: readonly GeyserHit[],
): boolean {
    for (const hit of hits) {
        s.p.vy = -520;
        s.p.vx += hit.push;
        s.p.w += hit.spin;
        s.rng.physics = hit.rng;
        if (!applyFocusHit(s, out, hit.focus)) {
            return false;
        }
        out.push({ type: 'cue', id: 'light-hit' });
    }
    return true;
}
