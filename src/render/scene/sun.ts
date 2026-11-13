import type { RenderCtx } from '../context';

/**
 * A bounded ThorVG radial light. Keeping Screen blend on the Shape preserves the luminous colour mixing
 * without asking the renderer to allocate and composite a full-canvas Scene.
 */
export function sunGlow(ctx: RenderCtx, top: number, bottom: number, alpha = 1) {
    const height = bottom - top;
    const x = ctx.cam + ctx.VW * .78;
    const y = top + height * .2;
    const radius = height * .42;
    ctx.ellipse(x, y, radius, radius,
        ctx.radialFill(x, y, radius, [[0, '#ffdfb56b'], [.56, '#fff2db25'], [1, '#fff2db00']], alpha),
        { blend: 'screen' });
}
