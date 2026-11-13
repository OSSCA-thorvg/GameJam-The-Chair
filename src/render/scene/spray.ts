import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import { skyWindResponse, sprayOrigin } from './sky-wind-response';

type Plume = {
    origin: Vector; dx: number; dy: number; length: number; spread: number; drift: number; age: number;
};

export function sprayPlume(ctx: RenderCtx) {
    const spray = ctx.state.spray;
    const continuous = (ctx.state.stage === 4 && ctx.state.sky.phase !== 'course') || ctx.state.firstFlight.kind !== 'course';
    if (!continuous && spray.burst <= 0) return;
    const age = continuous ? .9 + Math.sin(ctx.t * 14) * .045 : spray.burst / .24;
    const shape: Plume = { origin: sprayOrigin(ctx), dx: spray.dir.x, dy: spray.dir.y,
        length: 145 * age, spread: 34 * age, drift: skyWindResponse(ctx).plumeDrift * age, age };
    plumeCone(ctx, shape);
    if (continuous) plumePuffs(ctx, shape);
    plumeSwirl(ctx, shape);
}

// Wind carries older smoke farther sideways, leaving the nozzle fixed to the extinguisher.
function point(shape: Plume, along: number, across = 0): Vector {
    return [shape.origin[0] + shape.dx * shape.length * along - shape.dy * across + shape.drift * along * along,
        shape.origin[1] + shape.dy * shape.length * along + shape.dx * across];
}

function plumeCone(ctx: RenderCtx, shape: Plume) {
    const { spread, dx, dy, age } = shape;
    const tip = point(shape, 1);
    ctx.effectPath(shape.origin, [
        [...point(shape, .35, spread * .25), ...point(shape, .85, spread * .95), ...point(shape, 1, spread)],
        [tip[0] + dx * 10, tip[1] + dy * 10, tip[0] + dx * 10, tip[1] + dy * 10, ...point(shape, 1, -spread)],
        [...point(shape, .85, -spread * .95), ...point(shape, .35, -spread * .25), ...shape.origin],
    ], ctx.gradientFill(...shape.origin, ...tip, [
        [0, '#fffbedf0'], [.5, '#f3f0e3c0'], [1, '#e5e9e800'],
    ], .4 + age * .6));
}

function plumePuffs(ctx: RenderCtx, shape: Plume) {
    for (let i = 0; i < 7; i++) {
        const u = (ctx.t * 2.2 + i / 7) % 1;
        const wobble = Math.sin(i * 2.7 + ctx.t * 8) * shape.spread * u * .5;
        ctx.ellipse(...point(shape, u, wobble), 3 + u * 6, 3 + u * 5, ctx.tint('#f4f1e7', (1 - u) * .5));
    }
}

function plumeSwirl(ctx: RenderCtx, shape: Plume) {
    const swirl = Math.sin(ctx.t * 20) * shape.spread * .4;
    const tip = point(shape, 1);
    const start: Vector = [shape.origin[0] + shape.dx * 8, shape.origin[1] + shape.dy * 8];
    ctx.effectPath(start, [[...point(shape, .4, swirl), ...point(shape, .7, -swirl),
        tip[0] - shape.dx * 4, tip[1] - shape.dy * 4]],
    ctx.gradientFill(...shape.origin, ...tip, [[0, '#ffffffe0'], [1, '#ffffff00']], .7 * shape.age));
}
