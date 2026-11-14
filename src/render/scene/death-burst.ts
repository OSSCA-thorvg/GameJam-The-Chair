import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import { translate } from '../../i18n';
import { SIGN_FONT } from '../fonts';
import { PathBuilder, push } from './opening/shapes';

const INK = '#2b2f3a';

/** A stroke from `a` to `b` in a glyph box at `at`, `size` px tall. */
function stroke(ctx: RenderCtx, at: Vector, size: number, a: Vector, b: Vector, width: number) {
    const p = (q: Vector): Vector => [at[0] + q[0] * size, at[1] + q[1] * size];
    push(ctx, new PathBuilder(...p(a)).line(...p(b)).command(null, { width: width * size, color: INK, cap: 'round' }, true));
}

/**
 * "쿵!" drawn as strokes: the sign font carries only the glyphs of its own copy, so the syllable is built from
 * its jamo (ㅋ over ㅜ over ㅇ) instead. `at` is the box's top-left; `size` its height.
 */
function kungStrokes(ctx: RenderCtx, at: Vector, size: number) {
    const w = .12;
    stroke(ctx, at, size, [.18, .06], [.74, .06], w);
    stroke(ctx, at, size, [.74, .06], [.68, .36], w);
    stroke(ctx, at, size, [.24, .21], [.71, .21], w);
    stroke(ctx, at, size, [.04, .48], [.92, .48], w);
    stroke(ctx, at, size, [.48, .48], [.48, .64], w);
    push(ctx, new PathBuilder(at[0] + .74 * size, at[1] + .84 * size)
        .cubic(at[0] + .74 * size, at[1] + .7 * size, at[0] + .22 * size, at[1] + .7 * size, at[0] + .22 * size, at[1] + .84 * size)
        .cubic(at[0] + .22 * size, at[1] + .98 * size, at[0] + .74 * size, at[1] + .98 * size, at[0] + .74 * size, at[1] + .84 * size)
        .command(null, { width: w * size, color: INK, cap: 'round' }));
    stroke(ctx, at, size, [1.12, .08], [1.12, .7], w);
    stroke(ctx, at, size, [1.12, .92], [1.12, .93], w * 1.1);
}

/**
 * The comic burst at the moment the head strikes, beside the worker's face (`head`, on screen). It pops in with an
 * overshoot and shakes, then fades; `u` runs 0..1 through it.
 */
export function deathBurst(ctx: RenderCtx, head: Vector, u: number) {
    const pop = u < .2 ? .5 + .8 * Math.sin(u / .2 * Math.PI / 2) * 1.12 : 1.05 - .05 * Math.min(1, (u - .2) / .2);
    const alpha = u < .75 ? 1 : 1 - (u - .75) / .25;
    const size = ctx.clamp(ctx.W / 9, 70, 150) * pop;
    const shake = (1 - u) * 4;
    const cx = head[0] - size * .9 + Math.sin(u * 90) * shake, cy = head[1] - size * .75 + Math.cos(u * 77) * shake;
    const points: Vector[] = [];
    for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2, r = i % 2 ? .72 : 1 + (i % 4 === 0 ? .12 : 0);
        points.push([cx + Math.cos(a) * size * r, cy + Math.sin(a) * size * .72 * r]);
    }
    const hex = Math.round(alpha * 255).toString(16).padStart(2, '0');
    const path = points.slice(1).reduce((b, [x, y]) => b.line(x, y), new PathBuilder(...points[0]));
    ctx.beginLayer({ key: 'death-burst', opacity: alpha });
    push(ctx, path.line(...points[0]).command('#fff1b2' + hex, { width: 4, color: INK, cap: 'round' }));
    if (ctx.locale === 'ko') kungStrokes(ctx, [cx - size * .42, cy - size * .3], size * .6);
    else ctx.screenText(translate('impact.bonk', ctx.locale), cx, cy, size * .42, INK, { font: SIGN_FONT });
    ctx.endLayer();
}
