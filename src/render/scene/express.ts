import { STAGE_TWO, overPit } from '../../game/stages/building/data';
import type { DeepReadonly, Point } from '../../game/types';
import type { RenderCtx } from '../context';

// The rush-hour corridor: yellow-black cable covers, and a construction hole the empty chairs cross on a
// plank. The plank sags under each chair (a ThorVG Bézier whose middle drops with the load) and snaps
// when a chair carrying a human drops through it.
const FLOOR = 420;
const { bumps, pit } = STAGE_TWO.express;

// How high an empty chair bounces as it rolls over a cable cover at `x`.
export function chairHop(x: number) {
    for (const b of bumps) {
        const d = x - b + 20;
        if (d > 0 && d < 70) return Math.sin(d / 70 * Math.PI) * 12;
    }
    return 0;
}

export function expressFloor(ctx: RenderCtx, chairs: readonly DeepReadonly<Point & { released: boolean }>[]) {
    const { cam, VW, t } = ctx;
    if (pit.right < cam - 120 && bumps[bumps.length - 1] < cam - 80) return;
    if (bumps[0] > cam + VW + 80) return;

    // Cable covers.
    for (const b of bumps) {
        if (b < cam - 60 || b > cam + VW + 60) continue;
        ctx.polygon([[b - 24, FLOOR], [b - 14, FLOOR - 9], [b + 14, FLOOR - 9], [b + 24, FLOOR]], '#2c2f36');
        for (let i = -2; i <= 2; i++) ctx.polygon([[b + i * 9 - 3, FLOOR - 1], [b + i * 9 + 1, FLOOR - 8], [b + i * 9 + 5, FLOOR - 8], [b + i * 9 + 1, FLOOR - 1]], '#f2c14e');
    }
    if (pit.left > cam + VW + 120 || pit.right < cam - 120) return;

    // The hole: an opening in the floor, deeper toward the middle.
    const width = pit.right - pit.left;
    ctx.gradientPolygon([[pit.left, FLOOR], [pit.right, FLOOR], [pit.right, FLOOR + 400], [pit.left, FLOOR + 400]],
        ctx.gradientFill(0, FLOOR, 0, FLOOR + 260, [[0, '#3b4448'], [.25, '#1c2226'], [1, '#0b0e10']]));
    for (const x of [pit.left, pit.right]) ctx.rect(x - 4, FLOOR, 8, 400, '#5d6b6c');
    // Rebar and a loose cable down in the dark.
    for (let i = 1; i < 6; i++) ctx.rod(pit.left + i * width / 6, FLOOR + 70 + (i % 2) * 18, pit.left + i * width / 6 + 14, FLOOR + 160, 2, '#4a3b30');
    ctx.strokePath([pit.left + 20, FLOOR + 30], [[pit.left + 120, FLOOR + 160, pit.right - 140, FLOOR + 40, pit.right - 30, FLOOR + 120]], { width: 3, color: '#20262a', cap: 'round' });

    // Construction cones and tape at both edges.
    for (const x of [pit.left - 34, pit.right + 34]) cone(ctx, x);
    for (const [x0, x1] of [[pit.left - 34, pit.left - 4], [pit.right + 4, pit.right + 34]]) {
        ctx.rod(x0, FLOOR - 30, x1, FLOOR - 26, 3, '#f2c14e');
        for (let x = x0 + 3; x < x1; x += 8) ctx.rod(x, FLOOR - 29.5 + (x - x0) * 4 / (x1 - x0), x + 3, FLOOR - 29 + (x - x0) * 4 / (x1 - x0), 3, '#2c2f36');
    }

    // The plank: sags under the chairs on it and creaks; snaps once a human-laden chair drops through.
    const rider = ctx.p;
    const broken = overPit(rider.x) && rider.y > FLOOR - 16 && ctx.state.corridor.convoy !== 'carried';
    const left: [number, number] = [pit.left - 10, FLOOR - 2], right: [number, number] = [pit.right + 10, FLOOR - 2];
    if (!broken) {
        let load = 0, at = (pit.left + pit.right) / 2;
        for (const c of chairs) if (c.released && overPit(c.x)) { load++; at = c.x; }
        const sag = 3 + load * 5 + (load ? Math.sin(t * 30) * 1.2 : 0);
        const k = (at - pit.left) / width;
        const c1: [number, number] = [pit.left + width * Math.min(.7, k * .9), FLOOR - 2 + sag * 1.6];
        const c2: [number, number] = [pit.left + width * Math.max(.3, k * 1.1), FLOOR - 2 + sag * 1.6];
        ctx.strokePath(left, [[c1[0], c1[1], c2[0], c2[1], right[0], right[1]]], { width: 10, color: '#8a6a45', cap: 'butt' });
        ctx.strokePath(left, [[c1[0], c1[1] - 3, c2[0], c2[1] - 3, right[0], right[1] - 3]], { width: 3, color: '#b48a5a', cap: 'butt' });
    } else {
        // Two halves hang from the edges.
        const hang = Math.min(1.3, .4 + (rider.y - FLOOR) / 160);
        for (const [x, side] of [[left[0], 1], [right[0], -1]] as const) {
            const len = width / 2 - 6;
            const ex = x + side * Math.cos(hang) * len, ey = FLOOR - 2 + Math.sin(hang) * len;
            ctx.rod(x, FLOOR - 2, ex, ey, 10, '#8a6a45');
            ctx.polygon([[ex, ey - 6], [ex + side * 10, ey + 2], [ex - side * 2, ey + 9]], '#c9a06c');
        }
    }
}

function cone(ctx: RenderCtx, x: number) {
    ctx.polygon([[x - 13, FLOOR], [x - 4, FLOOR - 36], [x + 4, FLOOR - 36], [x + 13, FLOOR]], '#ef7d32');
    ctx.polygon([[x - 9, FLOOR - 14], [x - 6, FLOOR - 24], [x + 6, FLOOR - 24], [x + 9, FLOOR - 14]], '#f7efe0');
    ctx.rect(x - 17, FLOOR - 3, 34, 3, '#c25e22');
}
