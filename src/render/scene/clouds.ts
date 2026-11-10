import type { RenderCtx } from '../context';

export function ascentClouds(ctx: RenderCtx) {
    for (let i = 0; i < 5; i++) {
        const y = -850 - i * 220;
        for (let j = 0; j < 5; j++) {
            const x = ctx.cam + j * ctx.VW / 4 + Math.sin(i * 2 + j) * 60;
            ctx.ellipse(x, y + Math.sin(j * 3) * 32, 130, 38, '#f7f1e64a');
        }
    }
}

export { drawSky as drawCloudStart } from './sky';
