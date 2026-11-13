import type { RenderCtx } from '../context';
import type { Vector } from '../types';

const CEILING = 57;
const PIVOT_DROP = 18;

/** Security cameras hung at an even spacing under the ceiling, each one turning to follow the chair. */
export function ceilingCctvs(ctx: RenderCtx, spacing: number, offset = 0) {
    const first = Math.floor((ctx.cam - 60 - offset) / spacing) + 1;
    for (let i = first; i * spacing + offset < ctx.cam + ctx.VW + 60; i++) cctv(ctx, i * spacing + offset, i);
}

function cctv(ctx: RenderCtx, x: number, index: number) {
    const py = CEILING + PIVOT_DROP;
    const dx = ctx.p.x - x;
    const dy = ctx.p.y - 45 - py;
    const side = dx < 0 ? -1 : 1;
    const tilt = Math.max(.12, Math.min(1.25, Math.atan2(dy, Math.abs(dx))));
    const cos = Math.cos(tilt), sin = Math.sin(tilt);
    const at = (u: number, v: number): Vector => [x + side * (u * cos - v * sin), py + u * sin + v * cos];
    const shape = (points: Vector[], color: string) => ctx.polygon(points.map(([u, v]) => at(u, v)), color);

    ctx.rect(x - 11, CEILING, 22, 4, '#4b5468');
    ctx.rod(x, CEILING + 3, x, py, 4, '#5d6779');
    ctx.ellipse(x, py, 4, 4, '#3d4659');
    shape([[-20, -7], [12, -9], [17, -6], [17, 6], [12, 8], [-20, 7], [-24, 3], [-24, -3]], '#dcd7cf');
    shape([[-22, -9], [20, -11], [25, -15], [-22, -14]], '#b9b6bb');
    shape([[-18, 4], [10, 5], [10, 7], [-18, 6]], '#bfc4c9');
    const [lx, ly] = at(18, 0);
    ctx.ellipse(lx, ly, 3.2, 5.6, '#27344d');
    ctx.ellipse(lx + side * .8, ly - 1.4, 1.3, 1.8, '#7d9fbb');

    const near = Math.abs(dx) < 260;
    const blink = (ctx.t * (near ? 3 : 1) + index * .37) % 1 < (near ? .7 : .25);
    const [rx, ry] = at(-14, -3);
    ctx.ellipse(rx, ry, 2, 2, blink ? '#ff4b3e' : '#6b2a2a');
    if (blink) ctx.ellipse(rx, ry, 7, 7, ctx.radialFill(rx, ry, 7, [[0, '#ff5a4f'], [1, '#ff5a4f00']], .7), { blend: 'add' });
}
