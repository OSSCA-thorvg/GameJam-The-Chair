import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import { SPRAY_KEY } from '../../ui/controls';
import { keycap, keycapPop, keycapPress, keycapSize } from './keycap';

/** Seconds without spraying before the Space keycap pops up beside the extinguisher, and how fast it pops. */
export const SPRAY_HINT = { after: 3, pop: .25 };

/**
 * A Space keycap next to the extinguisher that keeps pressing itself down, shown only after the player has
 * coasted for a while without spraying. `idle` is those seconds; `anchor` the extinguisher on screen.
 */
export function orbitSprayHint(ctx: RenderCtx, anchor: Vector, idle: number) {
    const age = idle - SPRAY_HINT.after;
    if (age < 0) return;
    const { alpha, scale } = keycapPop(age, SPRAY_HINT.pop);
    const size = ctx.clamp(ctx.W / 52, 12, 20) * scale;
    const face = { text: SPRAY_KEY };
    const { w, h, depth } = keycapSize(ctx, face, size);
    const x = ctx.clamp(anchor[0] - w - size * 2.4, 10, Math.max(10, ctx.W - 10 - w));
    const y = ctx.clamp(anchor[1] - h * 1.2, 10, Math.max(10, ctx.H - 10 - h - depth));
    keycap(ctx, face, [x, y], size, alpha, keycapPress(age));
}
