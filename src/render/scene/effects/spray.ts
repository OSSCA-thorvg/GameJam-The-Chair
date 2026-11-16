import { skyWindResponse, sprayOrigin } from '../sky/wind-response';

import type { RenderCtx } from '../../context';
import type { Vector } from '../../types';

type Plume = {
    origin: Vector;
    dx: number;
    dy: number;
    length: number;
    spread: number;
    drift: number;
    age: number;
};

export function sprayPlume(ctx: RenderCtx): void {
    const spray = ctx.state.spray;
    const continuous =
        (ctx.state.stage === 4 && ctx.state.sky.phase !== 'course') ||
        ctx.state.firstFlight.kind !== 'course';
    if (!continuous && spray.burst <= 0) {
        return;
    }
    const age = continuous
        ? 0.9 + Math.sin(ctx.t * 14) * 0.045
        : spray.burst / 0.24;
    const shape: Plume = {
        origin: sprayOrigin(ctx),
        dx: spray.dir.x,
        dy: spray.dir.y,
        length: 145 * age,
        spread: 34 * age,
        drift: skyWindResponse(ctx).plumeDrift * age,
        age,
    };
    plumeCone(ctx, shape);
    if (continuous) {
        plumePuffs(ctx, shape);
    }
    plumeSwirl(ctx, shape);
}

function point(shape: Plume, along: number, across = 0): Vector {
    return [
        shape.origin[0] +
            shape.dx * shape.length * along -
            shape.dy * across +
            shape.drift * along * along,
        shape.origin[1] + shape.dy * shape.length * along + shape.dx * across,
    ];
}

function plumeCone(ctx: RenderCtx, shape: Plume) {
    const { spread, dx, dy, age } = shape;
    const tip = point(shape, 1);
    ctx.effectPath(
        shape.origin,
        [
            [
                ...point(shape, 0.35, spread * 0.25),
                ...point(shape, 0.85, spread * 0.95),
                ...point(shape, 1, spread),
            ],
            [
                tip[0] + dx * 10,
                tip[1] + dy * 10,
                tip[0] + dx * 10,
                tip[1] + dy * 10,
                ...point(shape, 1, -spread),
            ],
            [
                ...point(shape, 0.85, -spread * 0.95),
                ...point(shape, 0.35, -spread * 0.25),
                ...shape.origin,
            ],
        ],
        ctx.gradientFill(
            ...shape.origin,
            ...tip,
            [
                [0, '#fffbedf0'],
                [0.5, '#f3f0e3c0'],
                [1, '#e5e9e800'],
            ],
            0.4 + age * 0.6,
        ),
    );
}

function plumePuffs(ctx: RenderCtx, shape: Plume) {
    for (let i = 0; i < 7; i++) {
        const u = (ctx.t * 2.2 + i / 7) % 1;
        const wobble = Math.sin(i * 2.7 + ctx.t * 8) * shape.spread * u * 0.5;
        ctx.ellipse(
            ...point(shape, u, wobble),
            3 + u * 6,
            3 + u * 5,
            ctx.tint('#f4f1e7', (1 - u) * 0.5),
        );
    }
}

function plumeSwirl(ctx: RenderCtx, shape: Plume) {
    const swirl = Math.sin(ctx.t * 20) * shape.spread * 0.4;
    const tip = point(shape, 1);
    const start: Vector = [
        shape.origin[0] + shape.dx * 8,
        shape.origin[1] + shape.dy * 8,
    ];
    ctx.effectPath(
        start,
        [
            [
                ...point(shape, 0.4, swirl),
                ...point(shape, 0.7, -swirl),
                tip[0] - shape.dx * 4,
                tip[1] - shape.dy * 4,
            ],
        ],
        ctx.gradientFill(
            ...shape.origin,
            ...tip,
            [
                [0, '#ffffffe0'],
                [1, '#ffffff00'],
            ],
            0.7 * shape.age,
        ),
    );
}
