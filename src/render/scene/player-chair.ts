import type { RenderCtx } from '../context';
import { PLAYER_OUTLINES } from './player-art';
import { skyWindResponse } from './sky-wind-response';

export function playerChair(ctx: RenderCtx) {
    const C = ctx.C;
    const state = ctx.state;
    const rotation = ctx.rotation;
    ctx.rotation += skyWindResponse(ctx).chairTilt;
    if (state.hasExtinguisher) {
        ctx.rod(-39, -49, -45, -13, 4, '#394657');
        ctx.rect(-54, -48, 16, 39, '#b75f4a');
        ctx.ellipse(-46, -48, 8, 5, '#c7765c');
        ctx.rect(-52, -37, 12, 11, '#eee5cd');
        ctx.rod(-46, -52, -46, -59, 4, '#394657');
        ctx.rod(-49, -59, -35, -59, 3, '#394657');
        ctx.rod(-45, -52, -34, -44, 3, '#394657');
    }
    ctx.rod(0, -4, 0, 16, 6, C.steel);
    ctx.rod(-29, 21, 0, 13, 5, C.steel);
    ctx.rod(0, 13, 29, 21, 5, C.steel);
    for (const x of [-27, 27]) {
        ctx.ellipse(x, 23, 7, 8, '#3f4650');
        ctx.rod(x - 3 * Math.cos(ctx.wheel), 23 - 3 * Math.sin(ctx.wheel), x + 3 * Math.cos(ctx.wheel), 23 + 3 * Math.sin(ctx.wheel), 1, '#9197a2');
    }
    ctx.rod(-24, -10, -31, -61, 7, '#515665');
    ctx.polygon(PLAYER_OUTLINES.backrest, '#666d80');
    ctx.rect(-30, -15, 62, 12, '#6f7687');
    ctx.rod(-15, -22, -15, -8, 3, C.steel);
    ctx.rod(20, -22, 20, -8, 3, C.steel);
    ctx.rotation = rotation;
}
