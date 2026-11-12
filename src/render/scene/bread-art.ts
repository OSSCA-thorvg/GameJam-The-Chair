import type { RenderCtx } from '../context';
import type { Curve, Vector } from '../types';
import { seeded } from './cloud-art';

const BREAD_TOP = '#f8d98d';
const BREAD_MIDDLE = '#d9943b';
const BREAD_BOTTOM = '#8f4823';
const BREAD_CUT = '#fff0bd';
const BREAD_CUT_SHADOW = '#8b451f';
const SESAME = '#fff4cf';

const BODY_START: Vector = [-132, 26];
const BODY: Curve[] = [
    [-145, 4, -136, -27, -103, -34],
    [-96, -58, -62, -68, -38, -48],
    [-20, -75, 20, -76, 39, -48],
    [65, -65, 103, -51, 105, -30],
    [132, -25, 145, 2, 134, 28],
    [120, 52, 87, 59, 0, 58],
    [-85, 59, -120, 50, -132, 26],
];

function oval(x: number, y: number, rx: number, ry: number): [Vector, Curve[]] {
    const k = .5523;
    return [[x - rx, y], [
        [x - rx, y - ry * k, x - rx * k, y - ry, x, y - ry],
        [x + rx * k, y - ry, x + rx, y - ry * k, x + rx, y],
        [x + rx, y + ry * k, x + rx * k, y + ry, x, y + ry],
        [x - rx * k, y + ry, x - rx, y + ry * k, x - rx, y],
    ]];
}

/** A pull-apart loaf that takes the place of one stage-four cloud. */
export function floatingBread(ctx: RenderCtx, x: number, y: number, size: number, seed: number, alpha: number) {
    const random = seeded(seed);
    const ox = ctx.ox, oy = ctx.oy, scale = ctx.localScale, rotation = ctx.rotation;
    ctx.ox = x;
    ctx.oy = y;
    ctx.localScale = size;
    ctx.rotation = (random() - .5) * .18;

    ctx.effectPath(BODY_START, BODY, ctx.gradientFill(0, -72, 0, 60, [
        [0, BREAD_TOP], [.52, BREAD_MIDDLE], [1, BREAD_BOTTOM],
    ], alpha));
    ctx.effectPath(BODY_START, BODY, ctx.radialFill(-42, -42, 185, [
        [0, ctx.tint('#fff6d8', .62)], [.52, ctx.tint('#ffe3a0', .14)], [1, ctx.tint('#ffe3a0', 0)],
    ], alpha), { blend: 'screen' });

    for (const cutX of [-64, 0, 64]) {
        const start: Vector = [cutX - 18, -35];
        const cut: Curve[] = [[cutX - 6, -19, cutX + 5, -10, cutX + 17, 3]];
        ctx.strokePath(start, cut, { width: 10, color: ctx.tint(BREAD_CUT_SHADOW, .58 * alpha), cap: 'round' });
        ctx.strokePath([start[0] - 2, start[1] - 3], [[cutX - 7, -24, cutX + 2, -17, cutX + 13, -3]],
            { width: 5, color: ctx.tint(BREAD_CUT, .92 * alpha), cap: 'round' });
    }

    for (let i = 0; i < 7; i++) {
        const sx = -91 + random() * 182;
        const sy = -37 + random() * 48;
        const [start, curves] = oval(sx, sy, 2.7, 1.15);
        ctx.effectPath(start, curves, ctx.radialFill(sx - 1, sy - .5, 3.2, [
            [0, ctx.tint('#ffffff', .9)], [.45, ctx.tint(SESAME, .95)], [1, ctx.tint('#c98d42', .72)],
        ], alpha));
    }

    // A few crumbs make even the distant silhouettes read as bread instead of brown clouds.
    for (let i = 0; i < 3; i++) {
        const cx = 142 + i * 11 + random() * 7;
        const cy = 13 + i * 9 + random() * 7;
        const [start, curves] = oval(cx, cy, 2.4 - i * .35, 2 - i * .3);
        ctx.effectPath(start, curves, ctx.radialFill(cx - 1, cy - 1, 3, [
            [0, ctx.tint(BREAD_TOP, .95)], [1, ctx.tint(BREAD_BOTTOM, .8)],
        ], alpha));
    }

    ctx.ox = ox;
    ctx.oy = oy;
    ctx.localScale = scale;
    ctx.rotation = rotation;
}
