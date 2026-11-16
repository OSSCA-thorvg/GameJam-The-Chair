import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import { translate } from '../../i18n';
import { SIGN_FONT } from '../fonts';
import { PathBuilder, push } from './opening/shapes';

const INK = '#2b2f3a';

function stroke(
    ctx: RenderCtx,
    at: Vector,
    size: number,
    a: Vector,
    b: Vector,
    width: number,
) {
    const p = (q: Vector): Vector => [at[0] + q[0] * size, at[1] + q[1] * size];
    push(
        ctx,
        new PathBuilder(...p(a))
            .line(...p(b))
            .command(
                null,
                { width: width * size, color: INK, cap: 'round' },
                true,
            ),
    );
}

function kungStrokes(ctx: RenderCtx, at: Vector, size: number) {
    const w = 0.12;
    stroke(ctx, at, size, [0.18, 0.06], [0.74, 0.06], w);
    stroke(ctx, at, size, [0.74, 0.06], [0.68, 0.36], w);
    stroke(ctx, at, size, [0.24, 0.21], [0.71, 0.21], w);
    stroke(ctx, at, size, [0.04, 0.48], [0.92, 0.48], w);
    stroke(ctx, at, size, [0.48, 0.48], [0.48, 0.64], w);
    push(
        ctx,
        new PathBuilder(at[0] + 0.74 * size, at[1] + 0.84 * size)
            .cubic(
                at[0] + 0.74 * size,
                at[1] + 0.7 * size,
                at[0] + 0.22 * size,
                at[1] + 0.7 * size,
                at[0] + 0.22 * size,
                at[1] + 0.84 * size,
            )
            .cubic(
                at[0] + 0.22 * size,
                at[1] + 0.98 * size,
                at[0] + 0.74 * size,
                at[1] + 0.98 * size,
                at[0] + 0.74 * size,
                at[1] + 0.84 * size,
            )
            .command(null, { width: w * size, color: INK, cap: 'round' }),
    );
    stroke(ctx, at, size, [1.12, 0.08], [1.12, 0.7], w);
    stroke(ctx, at, size, [1.12, 0.92], [1.12, 0.93], w * 1.1);
}

export function deathBurst(ctx: RenderCtx, head: Vector, u: number) {
    const pop =
        u < 0.2
            ? 0.5 + 0.8 * Math.sin(((u / 0.2) * Math.PI) / 2) * 1.12
            : 1.05 - 0.05 * Math.min(1, (u - 0.2) / 0.2);
    const alpha = u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25;
    const size = ctx.clamp(ctx.W / 9, 70, 150) * pop;
    const shake = (1 - u) * 4;
    const cx = head[0] - size * 0.9 + Math.sin(u * 90) * shake,
        cy = head[1] - size * 0.75 + Math.cos(u * 77) * shake;
    const points: Vector[] = [];
    for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2,
            r = i % 2 ? 0.72 : 1 + (i % 4 === 0 ? 0.12 : 0);
        points.push([
            cx + Math.cos(a) * size * r,
            cy + Math.sin(a) * size * 0.72 * r,
        ]);
    }
    const hex = Math.round(alpha * 255)
        .toString(16)
        .padStart(2, '0');
    const path = points
        .slice(1)
        .reduce((b, [x, y]) => b.line(x, y), new PathBuilder(...points[0]));
    ctx.beginLayer({ key: 'death-burst', opacity: alpha });
    push(
        ctx,
        path
            .line(...points[0])
            .command('#fff1b2' + hex, { width: 4, color: INK, cap: 'round' }),
    );
    if (ctx.locale === 'ko') {
        kungStrokes(ctx, [cx - size * 0.42, cy - size * 0.3], size * 0.6);
    } else {
        ctx.screenText(
            translate('impact.bonk', ctx.locale),
            cx,
            cy,
            size * 0.42,
            INK,
            { font: SIGN_FONT },
        );
    }
    ctx.endLayer();
}
