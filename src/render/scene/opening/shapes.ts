import type { RenderCtx } from '../../context';
import type {
    Curve,
    DrawCommand,
    PathCommand,
    Gradient,
    Stroke,
    Vector,
} from '../../types';

const K = 0.5522847498;

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
    cubic(
        ax: number,
        ay: number,
        bx: number,
        by: number,
        x: number,
        y: number,
    ) {
        this.curves.push([ax, ay, bx, by, x, y]);
        this.at = [x, y];
        return this;
    }
    corner(cx: number, cy: number, x: number, y: number) {
        const [px, py] = this.at;
        return this.cubic(
            px + (cx - px) * K,
            py + (cy - py) * K,
            x + (cx - x) * K,
            y + (cy - y) * K,
            x,
            y,
        );
    }
    command(
        fill: string | Gradient | null,
        stroke?: Stroke,
        open = false,
    ): PathCommand {
        const cmd: PathCommand = {
            kind: 'path',
            points: [this.start],
            curves: this.curves,
            fill,
        };
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

export function polygon(
    ctx: RenderCtx,
    points: Vector[],
    fill: string | Gradient,
) {
    push(ctx, { kind: 'path', points, fill });
}

export function screenRect(ctx: RenderCtx, fill: string | Gradient) {
    polygon(
        ctx,
        [
            [-4, -4],
            [ctx.W + 4, -4],
            [ctx.W + 4, ctx.H + 4],
            [-4, ctx.H + 4],
        ],
        fill,
    );
}

export function linear(
    ctx: RenderCtx,
    from: Vector,
    to: Vector,
    stops: Array<[number, string]>,
    alpha = 1,
): Gradient {
    return {
        from,
        to,
        stops: stops.map(([at, color]) => [at, ctx.rgba(color, alpha)]),
    };
}

export function radial(
    ctx: RenderCtx,
    cx: number,
    cy: number,
    r: number,
    stops: Array<[number, string]>,
    alpha = 1,
): Gradient {
    return {
        from: [cx, cy],
        to: [cx + r, cy],
        radius: r,
        stops: stops.map(([at, color]) => [at, ctx.rgba(color, alpha)]),
    };
}

export function mix(a: string, b: string, u: number) {
    const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return (
        '#' +
        ca
            .map((v, i) =>
                Math.round(v + (cb[i] - v) * u)
                    .toString(16)
                    .padStart(2, '0'),
            )
            .join('')
    );
}

export function rotate(
    [x, y]: Vector,
    [cx, cy]: Vector,
    angle: number,
): Vector {
    const c = Math.cos(angle),
        s = Math.sin(angle);
    return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
}
