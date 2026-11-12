import type { RenderCtx } from '../../context';
import type { Curve, DrawCommand, Gradient, Stroke, Vector } from '../../types';

// Screen-space path helpers for the cutscene. Unlike the RenderCtx helpers these ignore the world camera:
// the clock, the bubbles and the full-screen lighting are laid out in canvas pixels.

/** Kappa for a quarter circle drawn with one cubic Bézier. */
const K = .5522847498;

export class PathBuilder {
    readonly start: Vector;
    readonly curves: Curve[] = [];
    private at: Vector;
    constructor(x: number, y: number) {
        this.start = [x, y];
        this.at = [x, y];
    }
    line(x: number, y: number) {
        this.curves.push([...this.at, x, y, x, y]);
        this.at = [x, y];
        return this;
    }
    cubic(ax: number, ay: number, bx: number, by: number, x: number, y: number) {
        this.curves.push([ax, ay, bx, by, x, y]);
        this.at = [x, y];
        return this;
    }
    /** Quarter-ellipse arc from the current point to (x, y), bulging along the given corner. */
    corner(cx: number, cy: number, x: number, y: number) {
        const [px, py] = this.at;
        return this.cubic(px + (cx - px) * K, py + (cy - py) * K, x + (cx - x) * K, y + (cy - y) * K, x, y);
    }
    command(fill: string | Gradient | null, stroke?: Stroke, open = false): DrawCommand {
        const cmd: DrawCommand = { v: [this.start], curves: this.curves, c: fill };
        if (stroke) cmd.stroke = stroke;
        if (open) cmd.open = true;
        return cmd;
    }
}

export function circle(cx: number, cy: number, rx: number, ry = rx) {
    return new PathBuilder(cx + rx, cy)
        .corner(cx + rx, cy + ry, cx, cy + ry)
        .corner(cx - rx, cy + ry, cx - rx, cy)
        .corner(cx - rx, cy - ry, cx, cy - ry)
        .corner(cx + rx, cy - ry, cx + rx, cy);
}

/** Circle starting at 12 o'clock and running clockwise, so trim fractions read like a dial. */
export function dialCircle(cx: number, cy: number, r: number) {
    return new PathBuilder(cx, cy - r)
        .corner(cx + r, cy - r, cx + r, cy)
        .corner(cx + r, cy + r, cx, cy + r)
        .corner(cx - r, cy + r, cx - r, cy)
        .corner(cx - r, cy - r, cx, cy - r);
}

export function push(ctx: RenderCtx, cmd: DrawCommand) {
    if (ctx.layer) cmd.layer = ctx.layer;
    ctx.commands.push(cmd);
}

export function polygon(ctx: RenderCtx, points: Vector[], fill: string | Gradient) {
    push(ctx, { v: points, c: fill });
}

export function screenRect(ctx: RenderCtx, fill: string | Gradient) {
    polygon(ctx, [[-4, -4], [ctx.W + 4, -4], [ctx.W + 4, ctx.H + 4], [-4, ctx.H + 4]], fill);
}

export function linear(ctx: RenderCtx, from: Vector, to: Vector, stops: [number, string][], alpha = 1): Gradient {
    return { from, to, stops: stops.map(([at, color]) => [at, ctx.rgba(color, alpha)]) };
}

export function radial(ctx: RenderCtx, cx: number, cy: number, r: number, stops: [number, string][], alpha = 1): Gradient {
    return { from: [cx, cy], to: [cx + r, cy], radius: r, stops: stops.map(([at, color]) => [at, ctx.rgba(color, alpha)]) };
}

/** Mix two #rrggbb colours. */
export function mix(a: string, b: string, u: number) {
    const ca = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
    const cb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
    return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v) * u).toString(16).padStart(2, '0')).join('');
}

/** Rotate `point` around `centre`. */
export function rotate([x, y]: Vector, [cx, cy]: Vector, angle: number): Vector {
    const c = Math.cos(angle), s = Math.sin(angle);
    return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
}
