import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import { LABEL_FONT } from '../fonts';
import { SPRAY_KEY } from '../../ui/controls';
import { PathBuilder, push } from './opening/shapes';

const hex = (a: number) => Math.round(a * 255).toString(16).padStart(2, '0');

/** Seconds without spraying before the Space keycap pops up beside the extinguisher, and how fast it pops. */
export const SPRAY_HINT = { after: 3, pop: .25 };

function keyPath([x, y]: Vector, w: number, h: number, r: number) {
    return new PathBuilder(x + r, y)
        .line(x + w - r, y).corner(x + w, y, x + w, y + r)
        .line(x + w, y + h - r).corner(x + w, y + h, x + w - r, y + h)
        .line(x + r, y + h).corner(x, y + h, x, y + h - r)
        .line(x, y + r).corner(x, y, x + r, y);
}

/**
 * A Space keycap next to the extinguisher that keeps pressing itself down, shown only after the player has
 * coasted for a while without spraying. `idle` is those seconds; `anchor` the extinguisher on screen.
 */
export function orbitSprayHint(ctx: RenderCtx, anchor: Vector, idle: number) {
    const age = idle - SPRAY_HINT.after;
    if (age < 0) return;
    const u = Math.min(1, age / SPRAY_HINT.pop), alpha = u;
    const pop = 1 + .25 * Math.sin(u * Math.PI);
    const size = ctx.clamp(ctx.W / 52, 12, 20) * pop;
    const w = ctx.measureText(SPRAY_KEY, size, LABEL_FONT) + size * 2.6, h = size * 1.9, depth = size * .35;
    // Pressed twice in quick succession, then a rest: a nudge rather than a steady blink.
    const beat = (age * 1.1) % 1, press = beat < .1 || (beat > .2 && beat < .3) ? 1 : 0;
    const x = ctx.clamp(anchor[0] - w - size * 2.4, 10, Math.max(10, ctx.W - 10 - w));
    const y = ctx.clamp(anchor[1] - h * 1.2, 10, Math.max(10, ctx.H - 10 - h - depth));
    const top = y + depth * press;
    push(ctx, keyPath([x, y + depth], w, h, size * .45).command('#7c8597' + hex(alpha)));
    push(ctx, keyPath([x, top], w, h, size * .45).command('#f4f1ea' + hex(alpha), { width: 2, color: '#2b2f3a' + hex(alpha), cap: 'round' }));
    ctx.screenText(SPRAY_KEY, x + w / 2, top + h / 2, size, '#2b2f3a', { font: LABEL_FONT, opacity: alpha });
}
