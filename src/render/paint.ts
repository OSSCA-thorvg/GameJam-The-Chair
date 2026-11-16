import { paintCanvas } from './paint/canvas';
import { collect } from './paint/commands';
import { paintThorvg } from './paint/thorvg';
import { applyLayerOverrides } from './perf';

import type { RenderCtx } from './context';
import type { PaintPool } from './paint/thorvg';
import type { LayerOverrides, RenderStats } from './perf';
import type { Canvas, ThorVGNamespace } from '@thorvg/webcanvas';

export {
    createPaintPool,
    thorvgTextWidth,
    type PaintPool,
} from './paint/thorvg';

export function paint(
    ctx: RenderCtx,
    tvg: ThorVGNamespace | null,
    canvas: Canvas | null,
    pool: PaintPool,
    stats?: RenderStats,
    overrides?: LayerOverrides,
): void {
    const commands = applyLayerOverrides(ctx.commands, overrides);
    if (stats) {
        stats.commands = commands.length;
    }
    if (tvg && canvas) {
        paintThorvg(ctx, tvg, canvas, pool, collect(commands), stats);
    } else {
        const start = stats ? performance.now() : 0;
        const bg = ctx.bg;
        bg.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
        bg.clearRect(0, 0, ctx.W, ctx.H);
        paintCanvas(ctx, bg, commands);
        if (stats) {
            stats.renderMs = performance.now() - start;
        }
    }
}
