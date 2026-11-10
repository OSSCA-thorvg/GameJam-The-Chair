import type { RenderCtx } from '../context';
import { player } from './player';
import { sprayPlume } from './spray';

export function ascentClouds(ctx: RenderCtx) {
    for (let i = 0; i < 5; i++) {
        const y = -850 - i * 220;
        for (let j = 0; j < 5; j++) {
            const x = ctx.cam + j * ctx.VW / 4 + Math.sin(i * 2 + j) * 60;
            ctx.ellipse(x, y + Math.sin(j * 3) * 32, 130, 38, '#f7f1e64a');
        }
    }
}

export function drawCloudStart(ctx: RenderCtx) {
    ctx.commands = [];
    ctx.ox = ctx.oy = ctx.rotation = 0;
    const top = -ctx.vertical, bottom = ctx.H / ctx.scale - ctx.vertical;
    ctx.gradientPolygon([[ctx.cam, top], [ctx.cam + ctx.VW, top], [ctx.cam + ctx.VW, bottom], [ctx.cam, bottom]],
        ctx.gradientFill(0, top, 0, bottom, [[0, '#769bbb'], [.6, '#acc3d2'], [1, '#eadbc4']]));
    for (let i = -1; i < 6; i++) {
        const x = i * 290 + ctx.cam * .72, y = -1900 - (i % 3) * 65;
        ctx.ellipse(x, y, 134, 17, '#f4eee871');
        ctx.ellipse(x - 31, y - 11, 68, 22, '#f4eee86a');
    }
    player(ctx);
    sprayPlume(ctx);
}
