import type { RenderCtx } from '../context';
import { CLOUD_TONES, puffCloud } from './cloud-art';

// The layers of cloud the chair punches through on its climb from the rooftop.
export function ascentClouds(ctx: RenderCtx) {
    ctx.beginLayer({ key: 'ascent-clouds', blur: 1 });
    for (let i = 0; i < 5; i++) {
        const y = -850 - i * 220;
        for (let j = 0; j < 5; j++) {
            const x = ctx.cam + j * ctx.VW / 4 + Math.sin(i * 2 + j) * 60;
            puffCloud(ctx, x, y + Math.sin(j * 3) * 32, .8 + ((i + j) % 3) * .12, 500 + i * 5 + j, CLOUD_TONES.ascent, { alpha: .62 });
        }
    }
    ctx.endLayer();
}

export { drawSky as drawCloudStart } from './sky';
