import type { Canvas, ThorVGNamespace } from '@thorvg/webcanvas';
import type { RenderCtx } from './context';
import {
    applyLayerOverrides,
    type LayerOverrides,
    type RenderStats,
} from './perf';
import { collect } from './paint/commands';
import { paintCanvas } from './paint/canvas';
import { paintThorvg, type PaintPool } from './paint/thorvg';

export {
    createPaintPool,
    thorvgTextWidth,
    type PaintPool,
} from './paint/thorvg';

export function paint(
    ctx: RenderCtx,
    TVG: ThorVGNamespace | null,
    tvg: Canvas | null,
    pool: PaintPool,
    stats?: RenderStats,
    overrides?: LayerOverrides,
) {
    const commands = applyLayerOverrides(ctx.commands, overrides);
    if (stats) stats.commands = commands.length;
    if (tvg && TVG) {
        paintThorvg(ctx, TVG, tvg, pool, collect(commands), stats);
    } else {
        const start = stats ? performance.now() : 0;
        const bg = ctx.bg;
        bg.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
        bg.clearRect(0, 0, ctx.W, ctx.H);
        paintCanvas(ctx, bg, commands);
        if (stats) stats.renderMs = performance.now() - start;
    }
}
