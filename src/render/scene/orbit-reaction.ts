import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import { SPEECH_FONT } from '../fonts';
import { PathBuilder, push } from './opening/shapes';

const MARKS = ['!', '✓', '…'];
const INK = '#2b2f3a';

/** A camera catches the rider; each second brings another wordless answer. */
export function orbitReaction(ctx: RenderCtx, head: Vector, age: number, lit: boolean) {
    if (!lit) return;
    const beat = age - Math.floor(age);
    const u = Math.min(1, beat / .18);
    const scale = .55 + .45 * (1 + 2.4 * (u - 1) ** 3 + 1.4 * (u - 1) ** 2);
    const size = ctx.clamp(ctx.H * .05, 16, 28);
    const tip: Vector = [head[0] + size * .35, head[1] - size * .2];
    const cx = ctx.clamp(head[0] + size * 2.45, size * 1.35, ctx.W - size * 1.35);
    const cy = ctx.clamp(head[1] - size * 1.4, size, ctx.H - size);
    const rx = size * 1.05, ry = size * .83;
    const at = (x: number, y: number): Vector => [tip[0] + (x - tip[0]) * scale, tip[1] + (y - tip[1]) * scale];
    const path = new PathBuilder(...at(cx, cy - ry))
        .cubic(...at(cx + rx * .62, cy - ry), ...at(cx + rx, cy - ry * .55), ...at(cx + rx, cy))
        .cubic(...at(cx + rx, cy + ry * .55), ...at(cx + rx * .62, cy + ry), ...at(cx, cy + ry))
        .cubic(...at(cx - rx * .38, cy + ry), ...at(cx - rx * .66, cy + ry * .78), ...at(cx - rx * .83, cy + ry * .5))
        .cubic(...at(cx - rx * 1.02, cy + ry * .85), ...at(tip[0] + size * .24, tip[1] - size * .08), ...tip)
        .cubic(...at(tip[0] + size * .2, tip[1] - size * .54), ...at(cx - rx * 1.05, cy + ry * .12), ...at(cx - rx, cy))
        .cubic(...at(cx - rx, cy - ry * .55), ...at(cx - rx * .62, cy - ry), ...at(cx, cy - ry));

    ctx.beginLayer({ key: 'orbit-reaction-shadow', blur: size * .28, opacity: .35 });
    push(ctx, path.command('#101b32'));
    ctx.endLayer();
    ctx.beginLayer({ key: 'orbit-reaction' });
    push(ctx, path.command('#ffffff', { width: 2, color: INK, cap: 'round' }));
    ctx.screenText(MARKS[Math.floor(age) % MARKS.length], ...at(cx, cy + size * .04), size * 1.05 * scale, INK, { font: SPEECH_FONT });
    ctx.endLayer();
}
