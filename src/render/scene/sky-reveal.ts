import { STAGE_FOUR } from '../../game/stages/sky/data';
import type { RenderCtx } from '../context';
import { createSkyProjection } from './sky-projection';
import { endingChair, endingClouds } from './sky-ending-art';

const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

// Screen-space commands still go through the shared ThorVG paint pool and Canvas2D fallback.
export function drawSkyReveal(ctx: RenderCtx) {
    const { sky } = ctx.state;
    const { settle, turn } = STAGE_FOUR.reveal;
    const elapsed = sky.phase === 'depth' ? settle + turn + sky.age : sky.age;
    const orbit = smooth((elapsed - settle) / turn);
    const view = createSkyProjection(ctx.W, ctx.H, orbit);
    ctx.commands.push({ v: [[0, 0], [ctx.W, 0], [ctx.W, ctx.H], [0, ctx.H]], c: {
        from: [0, 0], to: [0, ctx.H], stops: [[0, ctx.rgba('#678eae')], [1, ctx.rgba('#b7ced1')]],
    } });
    ctx.commands.push({ v: [[0, 0], [ctx.W, 0], [ctx.W, ctx.H], [0, ctx.H]],
        layer: { key: 'sky-ending-sunlight', blend: 'screen' }, c: {
            from: [ctx.W * .75, ctx.H * .15], to: [ctx.W, ctx.H], radius: ctx.W * .8,
            stops: [[0, ctx.rgba('#ffdfb5', .16)], [1, ctx.rgba('#ffdfb5', 0)]],
        },
    });
    endingClouds(view, elapsed);
    endingChair(view, elapsed);
    ctx.commands.push(...view.commands());
}
