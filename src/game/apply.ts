import type { GameState } from './state';
import type { GameEvent } from './types';
import { focusHit, type FocusHit } from './systems/focus';
import type { GeyserHit } from './systems/geyser';

// The only place where system decisions are written into game state. Systems decide; these apply.
// Each applier returns false when the attempt stopped (focus lost, death) so the step can end early.

export function applyFocusHit(s: GameState, out: GameEvent[], hit: FocusHit) {
    focusHit(s, out, hit.kind, hit.id, hit.damage);
    return s.mode === 'play';
}

export function applyGeyserHits(s: GameState, out: GameEvent[], hits: readonly GeyserHit[]) {
    for (const hit of hits) {
        s.p.vy = -520;
        s.p.vx += hit.push;
        s.p.w += hit.spin;
        s.rng.physics = hit.rng;
        if (!applyFocusHit(s, out, hit.focus)) return false;
        out.push({ type: 'cue', id: 'light-hit' });
    }
    return true;
}
